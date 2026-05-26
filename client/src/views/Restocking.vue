<template>
  <div class="restocking">

    <!-- Page header -->
    <div class="page-header">
      <h2>Restocking Planner</h2>
      <p class="page-subtitle">Review demand forecasts and plan your next restocking order</p>
    </div>

    <div v-if="loading">Loading...</div>
    <div v-else-if="error" class="error-message">{{ error }}</div>
    <div v-else>

      <!-- Success banner -->
      <div v-if="showSuccess" class="success-banner">{{ successMessage }}</div>

      <!-- Budget card -->
      <div class="card budget-card">
        <div class="card-header">
          <h3 class="card-title">Available Budget</h3>
        </div>
        <div class="budget-body">
          <div class="budget-display">
            <span class="budget-amount">{{ formatCurrency(budget) }}</span>
            <span :class="['budget-remaining', isOverBudget ? 'over-budget' : 'within-budget']">
              {{ isOverBudget ? 'Over budget by ' : 'Remaining: ' }}{{ formatCurrency(Math.abs(remainingBudget)) }}
            </span>
          </div>
          <input type="range" v-model.number="budget" min="0" max="500000" step="1000" class="budget-slider" />
          <div class="slider-labels">
            <span>$0</span>
            <span>$500,000</span>
          </div>
        </div>
      </div>

      <!-- Items table card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Demand Forecast Items</h3>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Item Name</th>
                <th>Trend</th>
                <th>Forecasted Demand</th>
                <th>Unit Cost</th>
                <th>Order Quantity</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in sortedItems"
                :key="item.id"
                :class="['item-row', { 'increasing-row': item.trend === 'increasing' }]"
              >
                <td><strong>{{ item.item_sku }}</strong></td>
                <td>{{ item.item_name }}</td>
                <td><span :class="['badge', item.trend]">{{ item.trend }}</span></td>
                <td>{{ item.forecasted_demand }}</td>
                <td>{{ formatCurrency(getUnitCost(item.item_sku)) }}</td>
                <td class="quantity-cell">
                  <input
                    type="range"
                    v-model.number="quantities[item.item_sku]"
                    min="0"
                    max="500"
                    step="10"
                    class="qty-slider"
                  />
                  <span class="qty-label">{{ quantities[item.item_sku] }}</span>
                </td>
                <td>
                  <strong :class="{ 'line-total-active': quantities[item.item_sku] > 0 }">
                    {{ formatCurrency(getLineTotal(item.item_sku)) }}
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Order summary footer -->
      <div class="card order-summary">
        <div class="summary-row">
          <div class="summary-stats">
            <span>{{ selectedItems.length }} item(s) selected</span>
            <span class="summary-divider">|</span>
            <span class="summary-total">Total: {{ formatCurrency(totalCost) }}</span>
            <span class="summary-divider">|</span>
            <span>Budget: {{ formatCurrency(budget) }}</span>
          </div>
          <div class="summary-action">
            <span v-if="isOverBudget" class="hint over-budget">
              Over budget by {{ formatCurrency(Math.abs(remainingBudget)) }} — reduce quantities
            </span>
            <span v-else-if="selectedItems.length === 0" class="hint">
              Select at least one item to place an order
            </span>
            <button class="btn-place-order" :disabled="!canPlaceOrder" @click="placeOrder">
              Place Order
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '../api'
import { useFilters } from '../composables/useFilters'
import { useRestockingOrders } from '../composables/useRestockingOrders'

export default {
  name: 'Restocking',
  setup() {
    const { selectedLocation, selectedCategory, getCurrentFilters } = useFilters()
    const { addRestockingOrder } = useRestockingOrders()

    const loading = ref(true)
    const error = ref(null)
    const forecastItems = ref([])
    const inventoryMap = ref({})
    const budget = ref(50000)
    const quantities = ref({})
    const showSuccess = ref(false)
    const successMessage = ref('')

    const loadData = async () => {
      try {
        loading.value = true
        error.value = null
        const filters = getCurrentFilters()
        const [forecasts, inventory] = await Promise.all([
          api.getDemandForecasts(),
          api.getInventory({ warehouse: filters.warehouse, category: filters.category })
        ])
        forecastItems.value = forecasts
        const map = {}
        inventory.forEach(item => { map[item.sku] = item })
        inventoryMap.value = map
        // Initialize quantities — assign new object for reactivity
        const q = {}
        forecasts.forEach(f => { q[f.item_sku] = 0 })
        quantities.value = q
      } catch (err) {
        error.value = 'Failed to load data'
        console.error(err)
      } finally {
        loading.value = false
      }
    }

    watch([selectedLocation, selectedCategory], loadData)
    onMounted(loadData)

    // Trend sort order: increasing first
    const TREND_ORDER = { increasing: 0, stable: 1, decreasing: 2 }

    const sortedItems = computed(() =>
      [...forecastItems.value].sort((a, b) => (TREND_ORDER[a.trend] ?? 3) - (TREND_ORDER[b.trend] ?? 3))
    )

    const getUnitCost = (sku) => inventoryMap.value[sku]?.unit_cost ?? 50
    const getLineTotal = (sku) => (quantities.value[sku] ?? 0) * getUnitCost(sku)

    const totalCost = computed(() =>
      sortedItems.value.reduce((sum, item) => sum + getLineTotal(item.item_sku), 0)
    )
    const remainingBudget = computed(() => budget.value - totalCost.value)
    const isOverBudget = computed(() => totalCost.value > budget.value)
    const selectedItems = computed(() =>
      sortedItems.value.filter(item => (quantities.value[item.item_sku] ?? 0) > 0)
    )
    const canPlaceOrder = computed(() => !isOverBudget.value && selectedItems.value.length > 0)

    const placeOrder = () => {
      if (!canPlaceOrder.value) return
      const items = selectedItems.value.map(item => ({
        sku: item.item_sku,
        name: item.item_name,
        quantity: quantities.value[item.item_sku],
        unit_price: getUnitCost(item.item_sku)
      }))
      const order = addRestockingOrder({ items, total_value: totalCost.value })
      successMessage.value = `Order ${order.order_number} submitted — expected delivery in 14 days`
      showSuccess.value = true
      // Reset quantities — assign new object to trigger reactivity
      const q = {}
      forecastItems.value.forEach(f => { q[f.item_sku] = 0 })
      quantities.value = q
      setTimeout(() => { showSuccess.value = false }, 4000)
    }

    const formatCurrency = (val) =>
      val.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

    return {
      loading,
      error,
      forecastItems,
      budget,
      quantities,
      showSuccess,
      successMessage,
      sortedItems,
      totalCost,
      remainingBudget,
      isOverBudget,
      selectedItems,
      canPlaceOrder,
      getUnitCost,
      getLineTotal,
      placeOrder,
      formatCurrency
    }
  }
}
</script>

<style scoped>
.restocking { display: flex; flex-direction: column; gap: 1.5rem; }

.page-header { margin-bottom: 0.5rem; }
.page-header h2 { font-size: 1.5rem; font-weight: 700; color: #0f172a; margin-bottom: 0.25rem; }
.page-subtitle { color: #64748b; font-size: 0.9rem; }

.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.5rem; }
.card-header { margin-bottom: 1rem; }
.card-title { font-size: 1rem; font-weight: 600; color: #0f172a; }

/* Budget card */
.budget-body { display: flex; flex-direction: column; gap: 0.75rem; }
.budget-display { display: flex; align-items: baseline; gap: 1.5rem; }
.budget-amount { font-size: 2rem; font-weight: 700; color: #0f172a; }
.budget-remaining { font-size: 0.9rem; font-weight: 500; }
.within-budget { color: #059669; }
.over-budget { color: #dc2626; }
.budget-slider { width: 100%; accent-color: #2563eb; cursor: pointer; }
.slider-labels { display: flex; justify-content: space-between; font-size: 0.75rem; color: #94a3b8; }

/* Table */
.table-container { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
th { text-align: left; padding: 0.75rem 1rem; background: #f8fafc; color: #64748b; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; }
td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #f8fafc; }

/* Row with increasing trend gets green left accent */
.increasing-row { border-left: 3px solid #10b981; }

/* Quantity cell */
.quantity-cell { display: flex; align-items: center; gap: 0.5rem; min-width: 140px; }
.qty-slider { flex: 1; accent-color: #2563eb; cursor: pointer; }
.qty-label { min-width: 2.5rem; font-weight: 600; color: #0f172a; text-align: right; }

.line-total-active { color: #2563eb; }

/* Order summary */
.order-summary { background: #f8fafc; }
.summary-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.summary-stats { display: flex; align-items: center; gap: 0.75rem; color: #64748b; font-size: 0.875rem; }
.summary-divider { color: #cbd5e1; }
.summary-total { font-weight: 600; color: #0f172a; }
.summary-action { display: flex; align-items: center; gap: 1rem; }
.hint { font-size: 0.8rem; color: #64748b; }
.hint.over-budget { color: #dc2626; }

.btn-place-order {
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 0.625rem 1.5rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.btn-place-order:hover:not(:disabled) { background: #1d4ed8; }
.btn-place-order:disabled { opacity: 0.45; cursor: not-allowed; }

/* Success banner */
.success-banner {
  background: #d1fae5;
  border: 1px solid #6ee7b7;
  color: #065f46;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
}

.error-message { color: #dc2626; padding: 1rem; }
</style>
