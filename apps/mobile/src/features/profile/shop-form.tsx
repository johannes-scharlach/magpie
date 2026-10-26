import {
  shopAccessOptions,
  shopRuleDescriptions,
  shopRuleOptions,
  type Shop,
  type ShopRule,
} from "@magpie/profile";
import { View } from "react-native";
import { ChoiceList } from "@/components/choice-list";
import { Text } from "@/components/ui/text";
import { Field, FormError } from "@/features/profile/form";

const choices = Object.entries(shopRuleOptions).map(([key, title]) => ({
  key,
  title,
  detail: shopRuleDescriptions[key as ShopRule],
}));

export function ShopForm({
  shop,
  onChange,
  validationAttempt = 0,
}: {
  shop: Shop;
  onChange: (shop: Shop) => void;
  validationAttempt?: number;
}) {
  return (
    <View className="gap-5">
      <Field
        label="Shop name"
        placeholder="e.g. Aldi, local butcher, weekly market"
        value={shop.name}
        onChangeText={(name) => onChange({ ...shop, name })}
        autoFocus={false}
        autoCapitalize="words"
        returnKeyType="done"
        error={
          validationAttempt > 0 && !shop.name.trim()
            ? "Enter a shop name."
            : null
        }
        validationAttempt={validationAttempt}
      />
      <View className="gap-3">
        <Text className="font-medium">How should Magpie use this shop?</Text>
        {!shop.rule && shop.access ? (
          <Text className="text-sm leading-5 text-muted-foreground">
            Previously marked “{shopAccessOptions[shop.access]}”. Choose the
            rule you want Magpie to follow.
          </Text>
        ) : null}
        <ChoiceList
          choices={choices}
          selectedKeys={shop.rule ? [shop.rule] : []}
          selection="single"
          onSelect={(rule) => onChange({ ...shop, rule: rule as ShopRule })}
        />
        <FormError
          message={
            validationAttempt > 0 && !shop.rule
              ? "Choose how Magpie should use this shop."
              : null
          }
        />
      </View>
    </View>
  );
}
