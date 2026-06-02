import bcrypt from 'bcryptjs';
import { prisma } from './db.js';

export async function seedDatabase() {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      console.log('🌱 [Seeder] Database already seeded. Skipping initial seeding.');
      return;
    }

    console.log('🌱 [Seeder] Database is empty. Seeding mock street vendors, services, and customer profiles...');

    const hashedPassword = await bcrypt.hash('password123', 10);

    // ==========================================
    // 1. SEED STREET VENDORS & SERVICES
    // ==========================================

    // VENDOR 1: Ramesh Chaat Bhandar (Chaat & Snacks)
    const vendor1 = await prisma.user.create({
      data: {
        name: 'Ramesh Chaat Bhandar',
        phone: '9876543210',
        password: hashedPassword,
        role: 'VENDOR',
      },
    });

    await prisma.shop.create({
      data: {
        name: 'Ramesh Special Golgappa & Chaat',
        description: 'Authentic Delhi-style tangy golgappas, crispy aloo tikki, and sweet dahi bhallas.',
        category: 'Chaat & Snacks',
        isActive: true, // Live by default for instant testing
        latitude: 28.6139,
        longitude: 77.2090,
        vendorId: vendor1.id,
        menuItems: {
          create: [
            { name: 'Golgappa Plate (6pcs)', description: 'Crispy semolina shells filled with spiced potatoes and tangy mint water', price: 40, daysAvailable: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday' },
            { name: 'Special Aloo Tikki', description: 'Crispy shallow-fried potato patties served with sweet curd, tamarind, and mint chutney', price: 50, daysAvailable: 'Monday,Wednesday,Friday,Saturday,Sunday' },
            { name: 'Papdi Chaat', description: 'Crunchy flour crackers topped with potatoes, chickpeas, yogurt, and spices', price: 45, daysAvailable: 'Tuesday,Thursday,Saturday,Sunday' },
          ],
        },
      },
    });

    // VENDOR 2: Sunita Sabzi Wale (Vegetables)
    const vendor2 = await prisma.user.create({
      data: {
        name: 'Sunita Sabzi Wale',
        phone: '8765432109',
        password: hashedPassword,
        role: 'VENDOR',
      },
    });

    await prisma.shop.create({
      data: {
        name: 'Sunita Fresh Organic Vegetables',
        description: 'Fresh organic green spinach, tomatoes, cauliflowers, potatoes, and kitchen herbs.',
        category: 'Vegetables',
        isActive: true,
        latitude: 28.6150,
        longitude: 77.2110,
        vendorId: vendor2.id,
        menuItems: {
          create: [
            { name: 'Organic Spinach Bunch', description: 'Freshly harvested iron-rich green spinach leaves', price: 30, daysAvailable: 'Monday,Tuesday,Wednesday,Thursday,Friday' },
            { name: 'Farm Fresh Tomatoes (1kg)', description: 'Juicy, naturally ripened red tomatoes', price: 40, daysAvailable: 'Monday,Wednesday,Friday' },
            { name: 'New Potatoes (1kg)', description: 'Freshly dug dirt-cleaned mountain potatoes', price: 35, daysAvailable: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday' },
          ],
        },
      },
    });

    // VENDOR 3: Sher Singh Steam Momos (Fast Food / Snacks)
    const vendor3 = await prisma.user.create({
      data: {
        name: 'Sher Singh Momos',
        phone: '9876543211',
        password: hashedPassword,
        role: 'VENDOR',
      },
    });

    await prisma.shop.create({
      data: {
        name: 'Sher Singh Hot & Steamy Momos',
        description: 'Tempting hot steamed and fried Himalayan veg and paneer momos served with fiery red chili dipping chutney.',
        category: 'Chaat & Snacks',
        isActive: true,
        latitude: 28.6120,
        longitude: 77.2070,
        vendorId: vendor3.id,
        menuItems: {
          create: [
            { name: 'Veg Steamed Momos (10pcs)', description: 'Himalayan wheat parcels stuffed with finely minced vegetables and herbs', price: 60, daysAvailable: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday' },
            { name: 'Paneer Fried Momos (10pcs)', description: 'Crispy deep-fried momos filled with fresh grated cottage cheese and mild spices', price: 90, daysAvailable: 'Monday,Wednesday,Friday,Saturday,Sunday' },
            { name: 'Tandoori Momos (8pcs)', description: 'Momos marinated in spiced tandoori yogurt and charcoal grilled', price: 110, daysAvailable: 'Friday,Saturday,Sunday' },
          ],
        },
      },
    });

    // VENDOR 4: Gupta Pav Bhaji & Vada Pav (Fast Food / Snacks)
    const vendor4 = await prisma.user.create({
      data: {
        name: 'Gupta Pav Bhaji',
        phone: '9876543212',
        password: hashedPassword,
        role: 'VENDOR',
      },
    });

    await prisma.shop.create({
      data: {
        name: 'Gupta Butter Pav Bhaji & Vada Pav',
        description: 'Mouthwatering butter-dripping Pav Bhaji served with chopped onions and lemons, alongside authentic Mumbai Vada Pav.',
        category: 'Chaat & Snacks',
        isActive: true,
        latitude: 28.6160,
        longitude: 77.2060,
        vendorId: vendor4.id,
        menuItems: {
          create: [
            { name: 'Special Butter Pav Bhaji', description: 'Thick mashed spicy vegetable gravy topped with a large dollop of butter, served with 2 warm buns', price: 80, daysAvailable: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday' },
            { name: 'Mumbai Classic Vada Pav', description: 'Spiced deep-fried potato dumpling inside a soft sliced bun with red dry garlic chutney', price: 30, daysAvailable: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday' },
            { name: 'Extra Butter Pav (Pair)', description: 'A pair of soft griddle-toasted buns buttered generously', price: 20, daysAvailable: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday' },
          ],
        },
      },
    });

    // VENDOR 5: Dhobi Ghat Laundry (Utility / Washer-Dryer)
    const vendor5 = await prisma.user.create({
      data: {
        name: 'Dhobi Ghat Laundry',
        phone: '9876543213',
        password: hashedPassword,
        role: 'VENDOR',
      },
    });

    await prisma.shop.create({
      data: {
        name: 'Dhobi Ghat Dry Cleaners & Washer-Dryer',
        description: 'Premium wash, high-heat tumble dry, express steam ironing, and dry cleaning services for all your premium garments.',
        category: 'General',
        isActive: true,
        latitude: 28.6110,
        longitude: 77.2130,
        vendorId: vendor5.id,
        menuItems: {
          create: [
            { name: 'Express Wash & Fold (1kg)', description: 'Hygienic machine wash with premium detergents followed by tumble drying and folding', price: 50, daysAvailable: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday' },
            { name: 'Premium Coat/Suit Dry Cleaning', description: 'Organic solvent cleaning of suits and blazer sets with safe cover protection', price: 250, daysAvailable: 'Monday,Wednesday,Saturday' },
            { name: 'Garment Steam Ironing (1pc)', description: 'Wrinkle-free professional steam press for shirts, trousers, or dresses', price: 10, daysAvailable: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday' },
          ],
        },
      },
    });

    // VENDOR 6: Verma Mobile Screen & Key Makers (Utility / Services)
    const vendor6 = await prisma.user.create({
      data: {
        name: 'Verma Repairs',
        phone: '9876543214',
        password: hashedPassword,
        role: 'VENDOR',
      },
    });

    await prisma.shop.create({
      data: {
        name: 'Verma Screen Guards & House Key Cutters',
        description: 'Instant mobile tempered glass installation, charging port repairs, and brass/silver door key duplicates.',
        category: 'General',
        isActive: true,
        latitude: 28.6180,
        longitude: 77.2100,
        vendorId: vendor6.id,
        menuItems: {
          create: [
            { name: 'House Key Duplication', description: 'High-precision computer-guided brass key profiling and duplicate cutting', price: 50, daysAvailable: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday' },
            { name: '11D Tempered Glass Installation', description: 'Ultra-tough shatterproof mobile screen protector with bubbles-free fitting', price: 120, daysAvailable: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday' },
            { name: 'USB-C Charging Port Replacement', description: 'Soldering and replacement of loose charging ports for basic smartphones', price: 200, daysAvailable: 'Monday,Tuesday,Wednesday,Thursday,Friday' },
          ],
        },
      },
    });

    // ==========================================
    // 2. SEED CUSTOMER ACCOUNT
    // ==========================================
    await prisma.user.create({
      data: {
        name: 'Ajeet Kumar',
        phone: '7654321098',
        password: hashedPassword,
        role: 'CUSTOMER',
      },
    });

    console.log('✅ [Seeder] Database seeded successfully! Available logins:');
    console.log('   👉 Customer: Phone [7654321098] / Password [password123]');
    console.log('   👉 Vendor 1 (Ramesh Chaat): Phone [9876543210] / Password [password123]');
    console.log('   👉 Vendor 2 (Sunita Sabzi): Phone [8765432109] / Password [password123]');
    console.log('   👉 Vendor 3 (Sher Singh Momos): Phone [9876543211] / Password [password123]');
    console.log('   👉 Vendor 4 (Gupta Pav Bhaji): Phone [9876543212] / Password [password123]');
    console.log('   👉 Vendor 5 (Dhobi Ghat Laundry): Phone [9876543213] / Password [password123]');
    console.log('   👉 Vendor 6 (Verma Repairs): Phone [9876543214] / Password [password123]');
  } catch (err) {
    console.error('❌ [Seeder] Seeding database failed:', err);
  }
}
