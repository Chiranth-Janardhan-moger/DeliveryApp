export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  orderId: string;
  customerName: string;
  phoneNumber: string;
  alternatePhone?: string;
  houseFlatNumber: string;
  streetArea: string;
  landmark: string;
  fullAddress: string;
  items: OrderItem[];
  deliveryTime: string;
  scheduledTime?: string;
  paymentMode: "Cash/UPI" | "Card" | "Paid";
  totalAmount: number;
  paymentStatus: "Paid" | "Pending";
  deliveryStatus: "Pending" | "Delivered";
  createdAt: string;
}
