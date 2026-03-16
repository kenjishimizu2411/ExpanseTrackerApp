import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Text, Button, TextInput, Icon, useTheme } from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSQLiteContext } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { asc, eq, like } from "drizzle-orm";

import * as schema from "../database/schemas/productSchema";
import { InputAmount } from "../components/index";

const CATEGORIES = [
  { id: "1", name: "Alimentação", icon: "silverware-fork-knife" },
  { id: "2", name: "Transporte", icon: "bus" },
  { id: "3", name: "Entretenimento", icon: "party-popper" },
  { id: "4", name: "Compras", icon: "shopping" },
  { id: "5", name: "Contas", icon: "file-document-outline" },
  { id: "6", name: "Outro", icon: "dots-horizontal" },
];

interface NewEntryScreenProps {
  navigation: any;
  route?: any;
}

export function NewEntryScreen({ navigation }: NewEntryScreenProps) {
  const theme = useTheme();
  const database = useSQLiteContext();

  const db = useMemo(() => drizzle(database, { schema }), [database]);

  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("1");
  const [categoryName, setCategoryName] = useState("Alimentação");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [wallet, setWallet] = useState<number>(0);
  const [walletExists, setWalletExists] = useState(false);

  const onChangeDate = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  async function fetchInitialData() {
    try {
      const responseWallet = await db.query.wallet.findFirst();
      if (responseWallet) {
        setWallet(responseWallet.value);
        setWalletExists(true);
      } else {
        setWallet(0);
        setWalletExists(false);
      }
    } catch (error) {
      console.error("Erro ao buscar dados iniciais:", error);
    }
  }

  const handleSave = async () => {
    if (!amount || amount <= 0 || !categoryName.trim()) {
      Alert.alert(
        "Atenção",
        "Preencha um valor válido e selecione uma categoria!",
      );
      return;
    }

    try {
      let finalCategoryId: number;
      let isCategoryIncome = false;

      const existingCategory = await db.query.category.findFirst({
        where: eq(schema.category.name, categoryName),
      });

      if (existingCategory) {
        finalCategoryId = existingCategory.id;
        isCategoryIncome = existingCategory.isIncome;
      } else {
        const newCategoryResponse = await db.insert(schema.category).values({
          name: categoryName,
          color: theme.colors.primary,
        });
        finalCategoryId = newCategoryResponse.lastInsertRowId;
        const finalAmount = isCategoryIncome ? amount : -amount;
      }
      const finalAmount = isCategoryIncome ? amount : -amount;

      await db.insert(schema.entry).values({
        description: description || categoryName,
        categoryId: finalCategoryId,
        date: date.toISOString(),
        value: finalAmount,
      });

      if (walletExists) {
        await db
          .update(schema.wallet)
          .set({ value: wallet + finalAmount })
          .where(eq(schema.wallet.id, 1));
      } else {
        await db.insert(schema.wallet).values({
          id: 1,
          value: finalAmount,
        });
      }

      Alert.alert("Sucesso", "Despesa salva com sucesso!");
      navigation.goBack();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      Alert.alert("Erro", "Não foi possível salvar a despesa.");
    }
  };

  const handleSelectCategory = (id: string, name: string) => {
    setSelectedCategory(id);
    setCategoryName(name);
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.amountContainer}>
        <InputAmount value={amount} onChangeValue={setAmount} />
      </View>

      <Text
        variant="titleMedium"
        style={[styles.sectionTitle, { color: theme.colors.onBackground }]}
      >
        Categorias
      </Text>

      <View style={styles.gridContainer}>
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.outline,
                },
                isSelected && {
                  borderColor: theme.colors.primary,
                  backgroundColor: theme.colors.elevation.level2,
                },
              ]}
              onPress={() => handleSelectCategory(cat.id, cat.name)}
            >
              <Icon
                source={cat.icon}
                size={24}
                color={
                  isSelected ? theme.colors.primary : theme.colors.onSurface
                }
              />
              <Text
                style={[
                  styles.cardText,
                  { color: theme.colors.onSurface },
                  isSelected && {
                    color: theme.colors.primary,
                    fontWeight: "bold",
                  },
                  { marginLeft: 8 },
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.inputsSection}>
        <Text style={[styles.label, { color: theme.colors.onBackground }]}>
          Data
        </Text>
        <TextInput
          mode="outlined"
          value={date.toLocaleDateString("pt-BR")}
          editable={false}
          style={[styles.inputField, { backgroundColor: theme.colors.surface }]}
          outlineStyle={styles.inputOutline}
          onPressIn={() => setShowDatePicker(true)}
          right={
            <TextInput.Icon
              icon="calendar"
              onPress={() => setShowDatePicker(true)}
            />
          }
        />

        {showDatePicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={date}
            mode="date"
            display="default"
            onChange={onChangeDate}
            maximumDate={new Date()}
          />
        )}

        <Text style={[styles.label, { color: theme.colors.onBackground }]}>
          Descrição
        </Text>
        <TextInput
          mode="outlined"
          placeholder="ex: Lanche com os amigos (opcional)."
          placeholderTextColor={theme.colors.onSurfaceDisabled}
          value={description}
          onChangeText={setDescription}
          style={[styles.inputField, { backgroundColor: theme.colors.surface }]}
          outlineStyle={styles.inputOutline}
        />
      </View>

      <Button
        mode="contained"
        onPress={handleSave}
        buttonColor={theme.colors.primary}
        textColor="#FFF"
        contentStyle={{ height: 56 }}
        style={styles.saveButton}
      >
        Salvar Despesa
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  amountContainer: { alignItems: "center", marginTop: 20 },
  sectionTitle: { fontWeight: "bold", marginBottom: 10, marginTop: 20 },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  card: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  cardText: { fontSize: 13, fontWeight: "500" },
  inputsSection: { gap: 15, marginTop: 10 },
  label: { fontSize: 14, marginBottom: 5, fontWeight: "600" },
  inputField: { fontSize: 16 },
  inputOutline: { borderRadius: 12, borderColor: "#E0E0E0" },
  saveButton: {
    marginVertical: 30,
    borderRadius: 12,
    justifyContent: "center",
    marginBottom: 60,
  },
});
