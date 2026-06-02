import { Router, Response } from 'express';
import { prisma } from '../../shared/db.js';
import { authenticateJWT, AuthenticatedRequest } from '../../middleware/auth.js';
import { eventBus, TOPICS } from '../../shared/EventBus.js';

const router = Router();

// 1. Customer creates an order
router.post('/create', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'Access denied: Customers only' });
  }

  const { shopId, items, totalAmount, deliveryLat, deliveryLng } = req.body;

  if (!shopId || !items || !totalAmount || deliveryLat === undefined || deliveryLng === undefined) {
    return res.status(400).json({ error: 'Missing required order placement details' });
  }

  try {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) return res.status(404).json({ error: 'Vendor shop not found' });
    if (!shop.isActive) return res.status(400).json({ error: 'Shop is currently closed' });

    const order = await prisma.order.create({
      data: {
        customerId: req.user.id,
        shopId,
        items: typeof items === 'string' ? items : JSON.stringify(items),
        totalAmount,
        status: 'PENDING',
        deliveryLat,
        deliveryLng,
      },
      include: {
        customer: { select: { name: true, phone: true } },
        shop: true,
      },
    });

    // Notify the vendor immediately via EventBus
    await eventBus.publish(TOPICS.ORDER_STATUS_CHANGES, {
      type: 'ORDER_CREATED',
      orderId: order.id,
      vendorId: shop.vendorId,
      customerId: req.user.id,
      customerName: req.user.name,
      customerPhone: req.user.phone,
      items: order.items,
      totalAmount: order.totalAmount,
      deliveryLat: order.deliveryLat,
      deliveryLng: order.deliveryLng,
      status: 'PENDING',
    });

    return res.status(201).json({ message: 'Order submitted successfully', order });
  } catch (err) {
    console.error('❌ [Order Creation Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Vendor fetches their active/pending order queue
router.get('/vendor-queue', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'VENDOR') {
    return res.status(403).json({ error: 'Access denied: Vendors only' });
  }

  try {
    const shop = await prisma.shop.findUnique({ where: { vendorId: req.user.id } });
    if (!shop) return res.status(404).json({ error: 'Shop not found' });

    const orders = await prisma.order.findMany({
      where: {
        shopId: shop.id,
        status: { in: ['PENDING', 'ACCEPTED', 'OUT_FOR_DELIVERY'] },
      },
      include: {
        customer: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json(orders);
  } catch (err) {
    console.error('❌ [Vendor Queue Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Vendor accepts or declines a pending order
router.post('/:orderId/respond', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'VENDOR') {
    return res.status(403).json({ error: 'Access denied: Vendors only' });
  }

  const { orderId } = req.params;
  const { action } = req.body; // "ACCEPT" or "DECLINE"

  if (action !== 'ACCEPT' && action !== 'DECLINE') {
    return res.status(400).json({ error: 'Action must be ACCEPT or DECLINE' });
  }

  const nextStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shop: true },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.shop.vendorId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized: This order is assigned to another vendor' });
    }
    if (order.status !== 'PENDING') {
      return res.status(400).json({ error: 'Can only respond to pending orders' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: nextStatus },
      include: { customer: { select: { name: true, phone: true } } },
    });

    // Notify customer & systems via EventBus
    await eventBus.publish(TOPICS.ORDER_STATUS_CHANGES, {
      type: `ORDER_${nextStatus}`,
      orderId: order.id,
      vendorId: req.user.id,
      customerId: order.customerId,
      status: nextStatus,
    });

    return res.status(200).json({ message: `Order was successfully ${nextStatus.toLowerCase()}ed`, order: updatedOrder });
  } catch (err) {
    console.error('❌ [Order Response Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 4. Vendor updates delivery progress status (OUT_FOR_DELIVERY, DELIVERED)
router.post('/:orderId/status', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'VENDOR') {
    return res.status(403).json({ error: 'Access denied: Vendors only' });
  }

  const { orderId } = req.params;
  const { status } = req.body; // "OUT_FOR_DELIVERY" or "DELIVERED"

  if (status !== 'OUT_FOR_DELIVERY' && status !== 'DELIVERED') {
    return res.status(400).json({ error: 'Status must be OUT_FOR_DELIVERY or DELIVERED' });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shop: true },
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.shop.vendorId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized: This order is assigned to another vendor' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: { customer: { select: { name: true, phone: true } } },
    });

    // Notify customer & systems via EventBus
    await eventBus.publish(TOPICS.ORDER_STATUS_CHANGES, {
      type: `ORDER_PROGRESS_${status}`,
      orderId: order.id,
      vendorId: req.user.id,
      customerId: order.customerId,
      status,
    });

    return res.status(200).json({ message: 'Order status updated successfully', order: updatedOrder });
  } catch (err) {
    console.error('❌ [Order Status Progress Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 5. Customer queries their historical/active orders
router.get('/customer-orders', authenticateJWT as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user || req.user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'Access denied: Customers only' });
  }

  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.user.id },
      include: {
        shop: {
          select: { name: true, category: true, vendor: { select: { name: true, phone: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json(orders);
  } catch (err) {
    console.error('❌ [Customer Orders Fetch Error]', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
