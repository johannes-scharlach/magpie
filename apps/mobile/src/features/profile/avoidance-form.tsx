import {
  tracePolicies,
  type HouseholdPerson,
  type IngredientAvoidance,
} from "@magpie/profile";
import { View } from "react-native";
import { ChoiceList } from "@/components/choice-list";
import { Text } from "@/components/ui/text";
import { Field, FormError, PickerRow } from "@/features/profile/form";

export function AvoidanceForm({
  item,
  people,
  onChange,
  attempted,
}: {
  item: Partial<IngredientAvoidance>;
  people: HouseholdPerson[];
  onChange: (item: Partial<IngredientAvoidance>) => void;
  attempted: boolean;
}) {
  const scopes = item.person_ids;
  const missingPeople = (scopes ?? []).filter(
    (id) => !people.some((p) => p.id === id),
  );
  return (
    <>
      <Field
        label="Food or ingredient"
        value={item.ingredient ?? ""}
        onChangeText={(ingredient) => onChange({ ...item, ingredient })}
        error={
          attempted && !item.ingredient?.trim()
            ? "Enter a food or ingredient."
            : null
        }
      />
      <View className="gap-2">
        <Text className="font-medium">Why leave it out?</Text>
        <ChoiceList
          selection="single"
          choices={[
            {
              key: "allergy",
              title: "Allergy",
            },
            {
              key: "restriction",
              title: "Must avoid",
            },
            {
              key: "dislike",
              title: "Don’t enjoy it",
            },
          ]}
          selectedKeys={item.kind ? [item.kind] : []}
          onSelect={(key) => {
            const next = { ...item, kind: key as IngredientAvoidance["kind"] };
            if (key !== "allergy") delete next.trace_policy;
            onChange(next);
          }}
        />
        <FormError
          message={
            attempted && !item.kind
              ? "Choose why Magpie should leave it out."
              : null
          }
        />
      </View>
      <View className="gap-2">
        <Text className="font-medium">Who is this for?</Text>
        {scopes === undefined && item.detail ? (
          <Text className="text-sm leading-5 text-muted-foreground">
            Your earlier notes still apply. Choose names to make this explicit.
          </Text>
        ) : null}
        <ChoiceList
          choices={[
            { key: "everyone", title: "Everyone" },
            ...people.map((p) => ({
              key: p.id,
              title: p.name.trim() || "You",
            })),
            ...missingPeople.map((id) => ({
              key: id,
              title: "Person no longer listed",
            })),
          ]}
          selectedKeys={scopes ? (scopes.length ? scopes : ["everyone"]) : []}
          onSelect={(key) => {
            if (key === "everyone") {
              onChange({ ...item, person_ids: [] });
              return;
            }
            const selected = scopes ?? [];
            if (selected.length === 1 && selected[0] === key) return;
            const ids = selected.includes(key)
              ? selected.filter((id) => id !== key)
              : [...selected, key];
            onChange({ ...item, person_ids: ids });
          }}
        />
      </View>
      {item.kind === "allergy" ? (
        <View className="gap-2">
          <PickerRow
            label="Traces"
            choices={[...Object.values(tracePolicies), "Check with me"]}
            selectedValue={
              item.trace_policy
                ? tracePolicies[item.trace_policy]
                : "Check with me"
            }
            onValueChange={(label) => {
              const next = { ...item };
              const policy = (
                Object.keys(tracePolicies) as NonNullable<
                  IngredientAvoidance["trace_policy"]
                >[]
              ).find((key) => tracePolicies[key] === label);
              if (policy) next.trace_policy = policy;
              else delete next.trace_policy;
              onChange(next);
            }}
          />
          <Text className="text-sm leading-5 text-muted-foreground">
            Use the allergy guidance you already follow. Magpie can’t check
            labels or kitchen safety.
          </Text>
        </View>
      ) : null}
      <Field
        label="Forms, preparation or exceptions"
        multiline
        value={item.detail ?? ""}
        onChangeText={(detail) => onChange({ ...item, detail })}
        placeholder={
          item.kind === "dislike"
            ? "e.g. No raw tomatoes. Cooked tomatoes are fine."
            : item.kind === "allergy"
              ? "e.g. Avoid sesame oil too. Use separate utensils."
              : "e.g. No alcohol, even when cooked."
        }
      />
    </>
  );
}
