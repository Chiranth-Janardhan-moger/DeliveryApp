import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';

export function OrdersExample() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  // Listen for real-time order updates
  useWebSocket('ORDER_DELIVERED', (data) => {
    console.log('Order delivered:', data);
    // Refresh orders list
    loadOrders();
  });

  const loadOrders = async () => {
    try {
      setLoading(true);
      const data = await api.getOrders({ page: 1, limit: 10 });
      setOrders(data.orders);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    try {
      await api.createOrder({
        customerName: 'John Doe',
        customerPhone: '9876543210',
        items: [{ name: 'Product 1', quantity: 2, price: 500 }],
        deliveryAddress: {
          addressLine: '123 Main St',
          city: 'Bangalore',
          pincode: '560001',
          latitude: 12.9716,
          longitude: 77.5946,
        },
        totalAmount: 1000,
        paymentMode: 'Cash',
      });
      loadOrders();
    } catch (error) {
      console.error('Failed to create order:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={handleCreateOrder}>Create Order</button>
      <ul>
        {orders.map((order) => (
          <li key={order.orderId}>
            {order.orderId} - {order.customerName} - {order.deliveryStatus}
          </li>
        ))}
      </ul>
    </div>
  );
}
