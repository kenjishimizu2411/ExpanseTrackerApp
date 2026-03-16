import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, Alert } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { InputAmount, TransactionItem, Header } from "../components/index";
import { useSQLiteContext } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as productSchema from "../database/schemas/productSchema";
import { asc, desc, eq, like } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";

const CATEGORIES = [
  { id: 1, name: "Alimentação", icon: "silverware-fork-knife" },
  { id: 2, name: "Transporte", icon: "bus" },
  { id: 3, name: "Entretenimento", icon: "party-popper" },
  { id: 4, name: "Compras", icon: "shopping" },
  { id: 5, name: "Contas", icon: "file-document-outline" },
  { id: 6, name: "Outro", icon: "dots-horizontal" },
];

type Data = {
  id: number;
  description: string;
  categoryId: number | null;
  date: string;
  value: number;
};

const formatarData = (dataIso: string) => {
  const date = new Date(dataIso);

  const options: Intl.DateTimeFormatOptions = {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat("pt-BR", options);
  const parts = formatter.formatToParts(date);

  const getPart = (type: string) => parts.find((p) => p.type === type)?.value;

  const hora = getPart("hour");
  const minuto = getPart("minute");
  const dia = getPart("day");
  const mes = getPart("month");
  const ano = getPart("year");

  return `${hora}:${minuto}h - ${dia}/${mes}/${ano}`;
};

export function HomeScreen({ navigation }: any) {
  const theme = useTheme();

  const database = useSQLiteContext();
  const db = drizzle(database, { schema: productSchema });

  const [search, setSearch] = useState("");
  const [data, setData] = useState<Data[]>([]);

  const [wallet, setWallet] = useState<number | 0>(0);

  async function fetchProducts() {
    try {
      const responseWallet = await db.query.wallet.findMany({
        where: like(productSchema.wallet.value, `%${search}%`),
      });
      const response = await db.query.entry.findMany({
        where: like(productSchema.entry.description, `%${search}%`),
        orderBy: [desc(productSchema.entry.date)],
        limit: 5,
      });
      setWallet(responseWallet[0].value);
      setData(response);
    } catch (error) {
      console.log(error);
    }
  }

  async function remove(id: number) {
    try {
      Alert.alert("Remover", "Deseja remover?", [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Sim",
          onPress: async () => {
            const entry = await db.query.entry.findFirst({
              where: eq(productSchema.entry.id, id),
            });
            await db
              .delete(productSchema.entry)
              .where(eq(productSchema.entry.id, id));

            await db
              .delete(productSchema.category)
              .where(eq(productSchema.category.id, entry?.categoryId ?? 0));
            await db
              .update(productSchema.wallet)
              .set({
                value: wallet + (entry?.value || 0),
              })
              .where(eq(productSchema.wallet.id, 1));

            await fetchProducts();
          },
        },
      ]);
    } catch (error) {
      console.log(error);
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
      return () => {};
    }, []),
  );

  useEffect(() => {
    fetchProducts();
  }, [search]);

  async function show(id: number) {
    try {
      const entry = await db.query.entry.findFirst({
        where: eq(productSchema.entry.id, id),
      });
      const category = entry?.categoryId
        ? await db.query.category.findFirst({
            where: eq(productSchema.category.id, entry.categoryId),
          })
        : null;
      console.log(entry, category);

      if (entry && category) {
        console.log("=== DADOS RECUPERADOS ===");
        console.log(JSON.stringify({ entry, category }, null, 2));
        console.log("=========================");
      }
    } catch (error) {
      console.log(error);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Header
        title="Home"
        showBackButton={false}
        rightActionIcon="cog"
        onRightActionPress={() => navigation.navigate("Settings")}
      />

      <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 50 }}>
        <View style={styles.amountContainer}>
          <InputAmount value={wallet} onChangeValue={setWallet} />
        </View>

        <Text
          variant="titleLarge"
          style={{
            fontWeight: "bold",
            color: theme.colors.onBackground,
            marginVertical: 20,
          }}
        >
          Últimos lançamentos
        </Text>

        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <Pressable
              onLongPress={() => remove(item.id)}
              onPress={() => show(item.id)}
            >
              <TransactionItem
                title={item.description}
                date={formatarData(item.date)}
                amount={item.value}
                type="outcome"
                categoryIcon={
                  CATEGORIES.find(
                    (cat) => String(cat.id) === String(item.categoryId),
                  )?.icon || "dots-horizontal"
                }
              />
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <TransactionItem
              title="Lista vazia"
              description=""
              amount={0}
              type="income"
              categoryIcon=""
            />
          )}
          contentContainerStyle={{ gap: 15, paddingBottom: 100 }}
          style={{ flex: 1 }}
        />
      </View>

      {/* Botão Flutuante (FAB) */}
      <View style={styles.fabContainer}>
        <Pressable onPress={() => navigation.navigate("NewEntryScreen")}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  amountContainer: {
    marginTop: 40,
    marginBottom: 20,
    alignItems: "center",
  },
  fabContainer: {
    width: 67,
    height: 67,
    borderRadius: 35,
    overflow: "hidden",
    backgroundColor: "#1f9be2ff",
    position: "absolute",
    bottom: 30,
    right: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabText: {
    color: "#ffffff",
    fontSize: 40,
    textAlign: "center",
    marginTop: -5,
  },
});
