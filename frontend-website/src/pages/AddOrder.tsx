import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Save } from "lucide-react";
import { Order, OrderItem } from "@/types/order";
import { saveOrder, getDraft, clearDraft, generateOrderId, getOrders, saveDraft } from "@/utils/localStorage";
import { toast } from "@/hooks/use-toast";

export default function AddOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editOrderId = searchParams.get("edit");

  const [formData, setFormData] = useState<Partial<Order>>({
    orderId: generateOrderId(),
    customerName: "",
    phoneNumber: "",
    alternatePhone: "",
    houseFlatNumber: "",
    streetArea: "",
    landmark: "",
    deliveryTime: "Now",
    paymentMode: "Cash/UPI",
    totalAmount: 0,
    items: [{ id: Date.now().toString(), name: "", quantity: 1, price: 0 }],
  });

  useEffect(() => {
    if (editOrderId) {
      const orders = getOrders();
      const orderToEdit = orders.find(o => o.orderId === editOrderId);
      if (orderToEdit) {
        setFormData(orderToEdit);
      }
    } else {
      const draft = getDraft();
      if (draft) {
        setFormData(prev => ({ ...prev, ...draft, orderId: prev.orderId }));
      }
    }
  }, [editOrderId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!editOrderId) {
        saveDraft(formData);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [formData, editOrderId]);

  const updateFormData = <K extends keyof Order>(field: K, value: Order[K]) => {
    setFormData(prev => ({ ...prev, [field]: value } as Partial<Order>));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...(prev.items || []), { id: Date.now().toString(), name: "", quantity: 1, price: 0 }],
    }));
  };

  const removeItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      items: (prev.items || []).filter(item => item.id !== id),
    }));
  };

  const updateItem = <K extends keyof OrderItem>(id: string, field: K, value: OrderItem[K]) => {
    setFormData(prev => ({
      ...prev,
      items: (prev.items || []).map(item =>
        item.id === id ? ({ ...item, [field]: value } as OrderItem) : item
      ),
    }));
  };

  const calculateTotal = () => {
    return (formData.items || []).reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const qty = Number(item.quantity) || 0;
      return sum + price * qty;
    }, 0);
  };

  const generateFullAddress = () => {
    const parts = [
      formData.houseFlatNumber,
      formData.streetArea,
      formData.landmark,
    ].filter(Boolean);
    return parts.join(", ");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerName || !formData.phoneNumber) {
      toast({
        title: "Error",
        description: "Please fill in customer name and phone number",
        variant: "destructive",
      });
      return;
    }

    const order: Order = {
      orderId: formData.orderId!,
      customerName: formData.customerName,
      phoneNumber: formData.phoneNumber,
      alternatePhone: formData.alternatePhone,
      houseFlatNumber: formData.houseFlatNumber!,
      streetArea: formData.streetArea!,
      landmark: formData.landmark!,
      fullAddress: generateFullAddress(),
      items: formData.items!,
        scheduledTime: formData.scheduledTime,
        deliveryTime: formData.deliveryTime ?? "Now",
      paymentMode: formData.paymentMode!,
      totalAmount: calculateTotal(),
      paymentStatus: formData.paymentMode === "Paid" ? "Paid" : "Pending",
      deliveryStatus: "Pending",
      createdAt: new Date().toISOString(),
    };

    saveOrder(order);
    clearDraft();
    
    toast({
      title: "Success",
      description: editOrderId ? "Order updated successfully" : "Order created successfully",
    });

    navigate("/orders");
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{editOrderId ? "Edit Order" : "Add New Order"}</h1>
        <p className="text-muted-foreground">Fill in the order details below</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Customer Details</CardTitle>
            <CardDescription>Information about the customer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => updateFormData("customerName", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number *</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => updateFormData("phoneNumber", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alternatePhone">Alternate Phone Number</Label>
              <Input
                id="alternatePhone"
                type="tel"
                value={formData.alternatePhone}
                onChange={(e) => updateFormData("alternatePhone", e.target.value)}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="houseFlatNumber">House/Flat Number</Label>
                <Input
                  id="houseFlatNumber"
                  value={formData.houseFlatNumber}
                  onChange={(e) => updateFormData("houseFlatNumber", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="streetArea">Street / Area</Label>
                <Input
                  id="streetArea"
                  value={formData.streetArea}
                  onChange={(e) => updateFormData("streetArea", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="landmark">Landmark</Label>
              <Input
                id="landmark"
                value={formData.landmark}
                onChange={(e) => updateFormData("landmark", e.target.value)}
              />
            </div>

            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">Full Address</p>
              <p className="text-sm text-muted-foreground">{generateFullAddress() || "Address will appear here"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
            <CardDescription>Order ID: {formData.orderId}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(formData.items || []).map((item, index) => (
              <div key={item.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Item {index + 1}</h4>
                  {(formData.items?.length || 0) > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Item Name</Label>
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Price</Label>
                    <Input
                      type="number"
                      min="0"
                      value={item.price}
                      onChange={(e) => updateItem(item.id, "price", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addItem} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery & Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formData.deliveryTime === "Scheduled" && (
                <div className="space-y-2">
                  <Label>Scheduled Time</Label>
                  <Input
                    type="datetime-local"
                    value={formData.scheduledTime}
                    onChange={(e) => updateFormData("scheduledTime", e.target.value)}
                  />
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <ToggleGroup
                type="single"
                value={formData.paymentMode}
                onValueChange={(value) => typeof value === "string" && updateFormData("paymentMode", value as Order["paymentMode"])}
                className="justify-start"
              >
                <ToggleGroupItem value="Cash/UPI" aria-label="Cash or UPI payment" className="flex-1">
                  Cash/UPI
                </ToggleGroupItem>
                <ToggleGroupItem value="Card" aria-label="Card payment" className="flex-1">
                  Card
                </ToggleGroupItem>
                <ToggleGroupItem value="Paid" aria-label="Already paid" className="flex-1">
                  Paid
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="p-4 bg-primary/10 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total Amount</span>
                <span className="text-2xl font-bold text-primary">₹{calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" size="lg" className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            {editOrderId ? "Update Order" : "Save Order"}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => navigate("/orders")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
