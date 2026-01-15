#!/bin/bash

# Script to fix t('common.xxx') -> tCommon('xxx') patterns

FILES=(
  "src/pages/Analytics/AnalyticsOverview.tsx"
  "src/pages/Inventory/components/AddIngredientDialog.tsx"
  "src/pages/Inventory/components/AdjustInventoryStockDialog.tsx"
  "src/pages/Inventory/components/AdjustStockDialog.tsx"
  "src/pages/Inventory/components/InventoryMovementsDialog.tsx"
  "src/pages/Inventory/components/ModifierInventoryAnalytics.tsx"
  "src/pages/Inventory/components/ProductWizardDialog.tsx"
  "src/pages/Inventory/components/RawMaterialDialog.tsx"
  "src/pages/Inventory/components/RecipeDialog.tsx"
  "src/pages/Inventory/components/SimpleConfirmDialog.tsx"
  "src/pages/Inventory/components/StockMovementsDialog.tsx"
  "src/pages/Inventory/Pricing.tsx"
  "src/pages/Inventory/RawMaterials.tsx"
  "src/pages/Inventory/Recipes.tsx"
  "src/pages/Menu/Products/createProduct.tsx"
  "src/pages/Order/OrderId.tsx"
  "src/pages/Promotions/Coupons.tsx"
  "src/pages/Promotions/Discounts.tsx"
  "src/pages/Promotions/Discounts/DiscountDetail.tsx"
  "src/pages/Settings/components/PermissionSearch.tsx"
  "src/pages/Settings/RolePermissions.tsx"
  "src/pages/Shift/ShiftId.tsx"
  "src/pages/Venue/Edit/ContactImages.tsx"
  "src/pages/Tpv/Tpvs.tsx"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    # Check if file has t('common. pattern
    if grep -q "t('common\." "$file"; then
      echo "Processing $file..."

      # Replace t('common.xxx') with tCommon('xxx')
      # This handles both single and double quotes
      sed -i '' "s/t('common\.\([^']*\)')/tCommon('\1')/g" "$file"
      sed -i '' 's/t("common\.\([^"]*\)")/tCommon("\1")/g' "$file"

      # Check if tCommon is already defined
      if ! grep -q "t: tCommon" "$file"; then
        echo "  Adding tCommon import to $file"
        # This is trickier - we need to add the tCommon import
        # We'll do this manually for now
      fi
    fi
  fi
done

echo "Done! Please manually verify tCommon imports are added where needed."
