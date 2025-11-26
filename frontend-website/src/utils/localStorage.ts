import { Order } from "@/types/order";

const ORDERS_KEY = "orders";
const DRAFT_KEY = "order_draft";

export const getOrders = (): Order[] => {
  const orders = localStorage.getItem(ORDERS_KEY);
  return orders ? JSON.parse(orders) : [];
};

export const saveOrder = (order: Order): void => {
  const orders = getOrders();
  const existingIndex = orders.findIndex(o => o.orderId === order.orderId);
  
  if (existingIndex >= 0) {
    orders[existingIndex] = order;
  } else {
    orders.push(order);
  }
  
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
};

export const deleteOrder = (orderId: string): void => {
  const orders = getOrders().filter(o => o.orderId !== orderId);
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
};

export const updateOrderStatus = (orderId: string, status: "Pending" | "Delivered"): void => {
  const orders = getOrders();
  const order = orders.find(o => o.orderId === orderId);
  if (order) {
    order.deliveryStatus = status;
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  }
};

export const saveDraft = (draft: Partial<Order>): void => {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
};

export const getDraft = (): Partial<Order> | null => {
  const draft = localStorage.getItem(DRAFT_KEY);
  return draft ? JSON.parse(draft) : null;
};

export const clearDraft = (): void => {
  localStorage.removeItem(DRAFT_KEY);
};

export const generateOrderId = (): string => {
  return `ORD${Date.now()}`;
};
