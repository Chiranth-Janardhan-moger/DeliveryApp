import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getOrders } from "@/utils/localStorage";
import { Package, CheckCircle, Clock, Plus } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const orders = getOrders();

  const pendingOrders = orders.filter(o => o.deliveryStatus === "Pending").length;
  const deliveredOrders = orders.filter(o => o.deliveryStatus === "Delivered").length;
  const totalOrders = orders.length;

  const stats = [
    {
      title: "Total Orders",
      value: totalOrders,
      description: "All orders in system",
      icon: Package,
      color: "text-primary",
    },
    {
      title: "Pending Orders",
      value: pendingOrders,
      description: "Orders awaiting delivery",
      icon: Clock,
      color: "text-warning",
    },
    {
      title: "Delivered Orders",
      value: deliveredOrders,
      description: "Successfully completed",
      icon: CheckCircle,
      color: "text-success",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your order management system</p>
        </div>
        <Button onClick={() => navigate("/add-order")} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          New Order
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your orders efficiently</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/add-order")}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Order
            </Button>
            <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/orders")}>
              <Package className="h-4 w-4 mr-2" />
              View All Orders
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest orders in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {orders.slice(0, 5).map((order) => (
              <div key={order.orderId} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">{order.orderId}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">₹{order.totalAmount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{order.deliveryStatus}</p>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">No orders yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
