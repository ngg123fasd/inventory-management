import { ref } from 'vue'

// Module-level singleton — mirrors useFilters.js pattern so all callers share state
const restockingOrders = ref([])
const orderCounter = ref(0)

export function useRestockingOrders() {
  const addRestockingOrder = (orderData) => {
    orderCounter.value += 1
    const year = new Date().getFullYear()
    const seq = String(orderCounter.value).padStart(4, '0')
    const order = {
      id: 'RST-' + Date.now(),
      order_number: `RST-${year}-${seq}`,
      type: 'restocking',
      items: orderData.items,
      status: 'Processing',
      order_date: new Date().toISOString(),
      // Fixed 14-day lead time per product requirement
      expected_delivery: new Date(Date.now() + 14 * 86400000).toISOString(),
      total_value: orderData.total_value,
      warehouse: 'All Warehouses'
    }
    restockingOrders.value.unshift(order)
    return order
  }

  return { restockingOrders, addRestockingOrder }
}
