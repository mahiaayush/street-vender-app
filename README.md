# 🚚 Theliya Vale | Real-Time Street Vendor & Services Tracker

**Theliya Vale** is a real-time, event-driven street vendor and local doorstep services tracking application. It is designed to bridge the gap between street vendors (sabzi walas, food carts, laundry dry cleaners, key makers) and customers. Customers can discover nearby vendors in a live radar map or a proximity-sorted grid directory, view day-wise menu rate cards, place orders, and track vendor locations in real-time.

---

## 🛠️ Tech Stack

### 📱 Frontend (Web & Mobile Hybrid)
*   **Framework**: [Expo](https://expo.dev/) (SDK 51) & [React Native Web](https://necolas.github.io/react-native-web/)
*   **Routing & Navigation**: [React Navigation](https://reactnavigation.org/) (Native Stack & Bottom Tabs)
*   **Client Core**: React Hooks, Context API (`AuthContext`, `SocketContext`)
*   **Networking**: [Axios](https://axios-http.com/) (Custom Instances)
*   **Web Customization**: Custom `metro.config.js` with Web mocks and custom `index.html` with premium Google Fonts (`Inter` & `Outfit`) and Open Graph (OG) social tags.

### ⚙️ Backend (Event-Driven Microservices)
*   **Runtime & Language**: [Node.js](https://nodejs.org/) & [TypeScript](https://www.typescriptlang.org/) (ESM, executed via TSX)
*   **Server Framework**: [Express.js](https://expressjs.com/)
*   **Real-time Streaming**: [Socket.io](https://socket.io/) (WebSockets with JWT Handshake Auth)
*   **Event Broker**: [Apache Kafka](https://kafka.apache.org/) (Managed via [KafkaJS](https://kafka.js.org/))
*   **Database ORM**: [Prisma Client](https://www.prisma.io/)

### 🗄️ Database & Infrastructure
*   **Primary Relational Database**: [MySQL 8.0](https://www.mysql.com/) (Production)
*   **Local Caching & Cache-Fallback**: In-Memory Pub/Sub event emitter, SQLite option
*   **Infrastructure Hosting**: Docker & Docker Compose (MySQL, Zookeeper, Kafka)

---

## 🗄️ Database Schema & Table Structures

The database schema is partitioned into logically decoupled service domains. All primary keys utilize robust `UUID` strings.

### 1. `User` Table (Authentication Service)
Stores user credentials, profile names, and primary role definitions.
| Field Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(191)` | `PRIMARY KEY`, `DEFAULT(UUID)` | Unique identifier |
| `phone` | `VARCHAR(191)` | `UNIQUE`, `INDEX` | Login username / phone number |
| `password` | `VARCHAR(191)` | `NOT NULL` | Bcrypt hashed password |
| `name` | `VARCHAR(191)` | `NOT NULL` | Display/business name |
| `role` | `VARCHAR(191)` | `NOT NULL` | Role: `"VENDOR"` or `"CUSTOMER"` |
| `createdAt` | `DATETIME(3)` | `DEFAULT(CURRENT_TIMESTAMP)` | Time of registration |

### 2. `Shop` Table (Vendor & Profile Service)
Stores vendor shop details, active states, and coordinates.
| Field Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(191)` | `PRIMARY KEY`, `DEFAULT(UUID)` | Unique identifier |
| `name` | `VARCHAR(191)` | `NOT NULL` | Shop/Brand Display Name |
| `description`| `TEXT` | `NULLABLE` | Shop items, details, and tagline |
| `category` | `VARCHAR(191)` | `NOT NULL` | Business Category (e.g. Chaat, Vegetables) |
| `isActive` | `BOOLEAN` | `DEFAULT(false)` | Current status (Open/Closed) |
| `latitude` | `DOUBLE` | `NULLABLE` | Active GPS Latitude coordinate |
| `longitude` | `DOUBLE` | `NULLABLE` | Active GPS Longitude coordinate |
| `vendorId` | `VARCHAR(191)` | `UNIQUE`, `FOREIGN KEY` (User) | Owner VENDOR ID |
| `updatedAt` | `DATETIME(3)` | `ON UPDATE CURRENT_TIMESTAMP` | Last updated timestamp |

### 3. `OperatingHours` Table (Vendor Service)
Stores recurring weekly operating hours for shops.
| Field Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(191)` | `PRIMARY KEY`, `DEFAULT(UUID)` | Unique identifier |
| `shopId` | `VARCHAR(191)` | `FOREIGN KEY` (Shop), `INDEX` | Shop relation |
| `day` | `VARCHAR(191)` | `NOT NULL` | Day of week (e.g., `"Monday"`) |
| `openTime` | `VARCHAR(191)` | `NOT NULL` | `"HH:MM"` format |
| `closeTime` | `VARCHAR(191)` | `NOT NULL` | `"HH:MM"` format |

### 4. `MenuItem` Table (Menu & Rate Card Service)
Stores items and rates available on specific days of the week.
| Field Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(191)` | `PRIMARY KEY`, `DEFAULT(UUID)` | Unique identifier |
| `shopId` | `VARCHAR(191)` | `FOREIGN KEY` (Shop), `INDEX` | Shop relation |
| `name` | `VARCHAR(191)` | `NOT NULL` | Dish or Service name |
| `description`| `TEXT` | `NULLABLE` | Description of plate/garment details |
| `price` | `DOUBLE` | `NOT NULL` | Price in INR (₹) |
| `daysAvailable`| `VARCHAR(191)`| `NOT NULL` | Comma-separated days (e.g., `"Monday,Wednesday"`) |
| `createdAt` | `DATETIME(3)` | `DEFAULT(CURRENT_TIMESTAMP)` | Record creation time |

### 5. `MenuUnavailability` Table (Menu Override Service)
Stores date-specific unavailable/sold-out overrides.
| Field Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(191)` | `PRIMARY KEY`, `DEFAULT(UUID)` | Unique identifier |
| `menuItemId`| `VARCHAR(191)` | `FOREIGN KEY` (MenuItem) | Related menu item |
| `date` | `VARCHAR(191)` | `UNIQUE` (with `menuItemId`), `INDEX`| Specific date override `"YYYY-MM-DD"` |
| `createdAt` | `DATETIME(3)` | `DEFAULT(CURRENT_TIMESTAMP)` | Time marked out-of-stock |

### 6. `Order` Table (Order Service)
Stores transactional checkout details, delivery locations, and statuses.
| Field Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(191)` | `PRIMARY KEY`, `DEFAULT(UUID)` | Unique identifier |
| `customerId`| `VARCHAR(191)` | `FOREIGN KEY` (User), `INDEX` | Buying Customer ID |
| `shopId` | `VARCHAR(191)` | `FOREIGN KEY` (Shop), `INDEX` | Shop ID ordered from |
| `items` | `TEXT` | `NOT NULL` | Stringified JSON array of ordered products |
| `totalAmount`| `DOUBLE` | `NOT NULL` | Total cost |
| `status` | `VARCHAR(191)` | `NOT NULL` | Status: `"PENDING"`, `"ACCEPTED"`, etc. |
| `deliveryLat`| `DOUBLE` | `NOT NULL` | Target delivery Latitude |
| `deliveryLng`| `DOUBLE` | `NOT NULL` | Target delivery Longitude |
| `createdAt` | `DATETIME(3)` | `DEFAULT(CURRENT_TIMESTAMP)` | Order creation time |

### 7. `Rating` Table (Feedback & Review Service)
Stores stars and comments left by customers.
| Field Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `VARCHAR(191)` | `PRIMARY KEY`, `DEFAULT(UUID)` | Unique identifier |
| `shopId` | `VARCHAR(191)` | `FOREIGN KEY` (Shop), `INDEX` | Shop ID reviewed |
| `customerId`| `VARCHAR(191)` | `NOT NULL` | Commenting Customer ID |
| `stars` | `INT` | `NOT NULL` | Star count: `1` to `5` |
| `comment` | `TEXT` | `NULLABLE` | Written review content |
| `createdAt` | `DATETIME(3)` | `DEFAULT(CURRENT_TIMESTAMP)` | Time of review |

---

## 📈 System Process Charts

### 1. High-Level Architectural Pipeline
This chart depicts the modular flow of coordinates, data REST queries, and microservices databases.

```mermaid
flowchart TB
    subgraph Client Panel (React Native / Expo Web)
        A["Customer Map & Grid View"]
        B["Vendor Control Panel"]
    end

    subgraph API Ingestion & WebSockets Gateway
        C["HTTP REST Express API"]
        D["Socket.io Location Gateway"]
    end

    subgraph Messaging Broker
        E[("Kafka Topic: vendor-location-updates")]
        F[("Kafka Topic: order-status-changes")]
    end

    subgraph Service Backends & Consumers
        G["LocationProcessor Service"]
        H["Menu & Shop Service"]
        I["Order Service"]
    end

    subgraph Relational Databases (MySQL 8.0)
        DB1[("MySQL: street_vender_main")]
    end

    %% Routing Connections
    A & B -->|"REST Requests"| C
    B -->|"Coordinates Stream"| D
    D -->|"Publish Event"| E
    C -->|"Publish Event"| F
    E -->|"Consume Event"| G
    G -->|"Persist Coordinate"| DB1
    H & I -->|"Prisma Client Pools"| DB1
```

---

### 2. Real-Time Location Ingestion & Processing Pipeline
This sequence diagram demonstrates the high-throughput, decoupled location-tracking path from the vendor's GPS to the client radar views.

```mermaid
sequenceDiagram
    autonumber
    actor Vendor as Vendor GPS (Socket.io Client)
    participant Ingest as WebSocket Ingest Gateway
    participant Broker as Kafka Broker (kafkajs)
    participant Processor as Location Processor Service
    participant DB as MySQL Database
    participant Firebase as Firebase RTD Fallback (Maps)
    actor Customer as Customer View (Socket.io Client)

    Vendor->>Ingest: ws.emit('update-location', { lat, lng })
    Note over Ingest: Validate JWT Token & Vendor Role
    Ingest->>Broker: publish('vendor-location-updates', payload)
    Note over Broker: Event-queue topic offset
    Broker-->>Processor: Poll event stream
    Processor->>DB: prisma.shop.update({ lat, lng })
    Note over DB: Persisted in primary MySQL DB
    Processor->>Firebase: updateShopLocation({ lat, lng })
    Note over Firebase: Stream to fallback maps DB
    Firebase-->>Customer: ws.emit('live-vendor-coordinates')
    Note over Customer: Auto-pan map and animate marker
```

---

### 3. Date-Specific Menu Availability Process Flow
This flowchart maps the logical decision trees executed dynamically by the API and the React Native client to serve day-wise menus and handle unavailable overrides.

```mermaid
flowchart TD
    A["Customer requests shop menu (?date=YYYY-MM-DD)"] --> B["API parses YYYY-MM-DD to get Day of Week (e.g. Monday)"]
    B --> C["Fetch all MenuItems for Shop"]
    C --> D["Fetch MenuUnavailability records matching YYYY-MM-DD"]
    
    D --> E{"For each MenuItem..."}
    E --> F{"Is Day of Week in MenuItem.daysAvailable?"}
    
    F -->|No| G["Set isAvailableDay = false"]
    F -->|Yes| H["Set isAvailableDay = true"]
    
    H --> I{"Is MenuItem ID in MenuUnavailability for selected date?"}
    I -->|Yes| J["Set isUnavailableDate = true"]
    I -->|No| K["Set isUnavailableDate = false"]
    G --> K
    
    J & K --> L["Compute isAvailable = isAvailableDay && !isUnavailableDate"]
    L --> M["Return compiled JSON Menu to Customer"]
    
    M --> N{"Customer rendering inside app..."}
    N --> O{"Is item.isAvailable true?"}
    O -->|Yes| P["Render standard cards - Click triggers pre-filled order drawer"]
    O -->|No| Q["Render card greyed-out - Append 'Unavailable badge' & block checkout click"]
```

---

## 🚦 Installation & Run Instructions

### 1. MySQL Setup
Ensure your native MySQL server is active. Start it using your macOS Preference Settings, or by running the terminal command:
```bash
sudo /usr/local/mysql/support-files/mysql.server start
```

### 2. Configure Environment Variables
Verify a `.env` file exists in the **root** folder containing your local credentials (with `@` symbol URL-encoded as `%40`):
```ini
DATABASE_URL="mysql://root:infotech%400193@localhost:3306/street_vender_main"
PORT=4000
JWT_SECRET="super-secret-vendor-key-123"
USE_KAFKA=true
KAFKA_BROKERS="localhost:9092"
KAFKA_CLIENT_ID="street-vendor-tracker"
```

### 3. Sync Database Tables
Create all MySQL tables and sync the Prisma schema by running:
```bash
npx prisma db push --schema=backend/prisma/schema.prisma
```

### 4. Start Servers
Launch the Express backend microservices and the Expo Metro bundler concurrently:
```bash
npm run dev
```
Open **[http://localhost:8081](http://localhost:8081)** to load the application!
