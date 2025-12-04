# 🚚 DSK Delivery – Admin Panel

This is the **Admin website** for the DSK Delivery system.  
Admins create and assign orders; delivery boys receive the orders in their mobile app and deliver them to the customer’s doorstep.

**Live Website:** https://dskadmin.vercel.app/

---

## ⭐ What this system does
- Admin can create new delivery orders  
- Admin can assign orders to delivery boys  
- Delivery boys receive orders in their app  
- Delivery boys view pickup & drop locations  
- Delivery boys deliver items to customer doorstep  
- Real-time order status updates (Pending → Assigned → Picked → Delivered)

---

## 🧩 Flow of the System
1. Admin logs in to this website  
2. Admin creates an order (customer name, phone, address, items, etc.)  
3. Admin assigns the order to a delivery boy  
4. Delivery boy gets the order in the Delivery App  
5. Delivery boy picks item → travels to customer → delivers  
6. Admin sees live status of each order

---

## ⚙️ Tech Stack Used

### Frontend (Admin Website)
- React / Next.js  
- TailwindCSS  
- Axios  
- Vercel (hosting)

### Backend (API Server)
- Node.js + Express  
- MongoDB  
- JWT Auth  
- Render / Railway (hosting)

---

## 📸 Screenshots (Add yours later)
Place screenshots in `docs/screenshots/` and update filenames if needed.

![Dashboard](./docs/screenshots/dashboard.png)  
![Orders](./docs/screenshots/orders.png)  
![Assign](./docs/screenshots/assign.png)  

---

## 🗂️ Features

### 🛂 Admin
- Login / Logout  
- Add delivery boys (create rider accounts)  
- Create orders (customer details, items, price)  
- Assign orders to delivery boys  
- Track order status (Pending, Assigned, Picked, Delivered, Cancelled)  
- View completed & cancelled orders  
- Search / filter orders by status, date, rider, zone

### 📱 Delivery Boy App (mobile)
- Login (mobile credentials)  
- View assigned orders list  
- Accept / Start / Complete orders  
- Navigate to pickup/drop location (maps link)  
- Update real-time location (optional)  
- Change status to Delivered and add proof (photo/signature) (optional)

---

## 🛠️ How to Run Locally

### 1️⃣ Clone the project
```bash
git clone <repo-url>
cd <project-folder>
```

### 2️⃣ Install dependencies
```bash
npm install
# or if frontend/backend separate:
# cd client && npm install
# cd ../server && npm install
```

### 3️⃣ Add your environment variables
Create a `.env` file at the appropriate root(s).

**Frontend (`.env.local` or `.env`)**
```
NEXT_PUBLIC_API_URL=https://your-backend-url
```

**Backend (`.env`)**
```
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/dskdb?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=1d
REFRESH_TOKEN_SECRET=your_refresh_secret
```

> Make sure CORS origin includes your Vercel domain if you use cookies:
```
CORS_ORIGINS=https://dskadmin.vercel.app,http://localhost:3000
```

### 4️⃣ Start development

**If single repo (frontend only)**:
```bash
npm run dev
```

**If separate frontend and backend**:
```bash
# backend
cd server
npm run dev

# frontend
cd ../client
npm run dev
```

---

## 📡 API Overview

> These are example endpoints—match them to your actual server routes.

### Authentication
```
POST /api/auth/login        → Admin login (body: { email, password })
POST /api/auth/register     → (optional) Create admin/operator
```

### Orders
```
POST /api/orders/create     → Create a new order (body: { customerName, phone, address, items, total, zone })
GET  /api/orders            → Get all orders (supports query filters: ?status=, ?rider=, ?date=)
GET  /api/orders/:id        → Get single order detail
PUT  /api/orders/:id/status → Update order status (body: { status: "Assigned" | "Picked" | "Delivered" })
DELETE /api/orders/:id      → (optional) Delete order
```

### Delivery Boys (Riders)
```
GET  /api/delivery-boys           → Get delivery boy list
POST /api/delivery-boys           → Add delivery boy
PUT  /api/delivery-boys/:id       → Update delivery boy info
PUT  /api/assign/:orderId         → Assign order to a delivery boy (body: { riderId })
GET  /api/delivery-boys/:id/orders → Get orders assigned to a rider
```

### Real-time / Optional
- WebSocket namespace `/ws/orders` or Socket.IO for live updates: rider location & live status pushes.

---

## 🔒 Auth & Security Notes
- Use JWT access tokens and refresh tokens (store refresh token as httpOnly cookie).  
- Protect write endpoints with `isAdmin` / `isOperator` middleware.  
- Validate inputs with `Joi` or `express-validator`.  
- Add rate limiting (`express-rate-limit`) and HTTP headers (`helmet`).  
- Sanitize user input to prevent injection attacks.

---

## 🚀 Deployment

### Frontend (Vercel)
1. Connect GitHub repo to Vercel.  
2. Build command: `npm run build` (Next.js: `next build`)  
3. Set environment variables in Vercel dashboard: `NEXT_PUBLIC_API_URL` → your backend URL.  
4. If serving static assets or image domains, update `next.config.js`.

### Backend (Render / Railway / Heroku)
1. Push server to GitHub and connect to Render/Railway.  
2. Set env vars (`MONGO_URI`, `JWT_SECRET`, etc.) on the hosting dashboard.  
3. Ensure CORS includes your Vercel domain:
```js
// Express example
const cors = require('cors');
app.use(cors({
  origin: ['https://dskadmin.vercel.app', 'http://localhost:3000'],
  credentials: true
}));
```
4. If using WebSockets, ensure the platform supports sticky sessions / websockets.

---

## ✅ Common Troubleshooting
- **Blank page on load**: Check browser console for runtime errors, verify `NEXT_PUBLIC_API_URL` is set.  
- **CORS errors**: Confirm server `Access-Control-Allow-Origin` and `credentials` match frontend.  
- **Auth loops**: Check refresh-token cookie is set (httpOnly) and refresh endpoint returns new access token.  
- **Images 404**: For Next.js add remote domains in `next.config.js` or serve assets from same domain.

---

## 📦 Useful Scripts (examples)
**Frontend `package.json`**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

**Backend `package.json`**
```json
{
  "scripts": {
    "dev": "nodemon index.js",
    "start": "node index.js",
    "test": "jest"
  }
}
```

---

## 🧪 Testing
- Unit tests: Jest for backend, React Testing Library for frontend.  
- E2E: Cypress or Playwright for flows (login → create order → assign → deliver).

---

## 📁 Repo Structure (suggested)
```
/client         # frontend (Next.js or React)
  /pages
  /components
  /styles
/server         # backend (Express)
  /controllers
  /models
  /routes
  /middlewares
docs/
  /screenshots
README.md
```

---

## 🙋‍♂️ Author
**Developed by Chiranth**

---

## 📝 License
MIT License — add `LICENSE` file if required.

---

