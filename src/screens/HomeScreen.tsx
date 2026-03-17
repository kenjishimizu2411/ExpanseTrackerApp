import React, { useCallback, useEffect, useState, useMemo } from "react";
import { View, StyleSheet, FlatList, Pressable, Alert } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { TransactionItem, Header } from "../components/index";
import { useSQLiteContext } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as productSchema from "../database/schemas/productSchema";
import { desc, eq } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";

// Mapa de ícone por nome de categoria (mantido em sincronia com NewEntryScreen)
const CATEGORY_ICONS: Record<string, string> = {
  Alimentação: "silverware-fork-knife",
  Transporte: "bus",
  Entretenimento: "party-popper",
  Compras: "shopping",
  Contas: "file-document-outline",
  Salário: "cash",
  Freelance: "laptop",
};
const DEFAULT_ICON = "dots-horizontal";

type Entry = typeof productSchema.entry.$inferSelect;

const formatarData = (dataIso: string): string => {
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
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "??";
  return `${get("hour")}:${get("minute")}h - ${get("day")}/${get("month")}/${get("year")}`;
};

export function HomeScreen({ navigation }: any) {
  const theme = useTheme();
  const database = useSQLiteContext();
  // useMemo: evita recriar o objeto drizzle a cada render
  const db = useMemo(
    () => drizzle(database, { schema: productSchema }),
    [database],
  );

  const [entries, setEntries] = useState<Entry[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  async function fetchData() {
    try {
      // Wallet: se não existir ainda, mantém 0 sem crashar
      const walletRows = await db.select().from(productSchema.wallet).limit(1);
      setWalletBalance(walletRows[0]?.value ?? 0);

      const response = await db
        .select()
        .from(productSchema.entry)
        .orderBy(desc(productSchema.entry.date))
        .limit(5);
      setEntries(response);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    }
  }

  async function remove(id: number) {
    const entryToDelete = await db
      .select()
      .from(productSchema.entry)
      .where(eq(productSchema.entry.id, id))
      .limit(1);

    if (entryToDelete.length === 0) return;
    const entry = entryToDelete[0];

    Alert.alert("Remover lançamento", "Deseja remover este lançamento?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          try {
            await db
              .delete(productSchema.entry)
              .where(eq(productSchema.entry.id, id));

            // CORREÇÃO: não apaga a categoria — ela é compartilhada entre lançamentos.
            // Apenas estorna o valor no saldo.
            await db
              .update(productSchema.wallet)
              .set({ value: walletBalance - entry.value })
              .where(eq(productSchema.wallet.id, 1));

            await fetchData();
          } catch (error) {
            console.error("Erro ao remover:", error);
          }
        },
      },
    ]);
  }

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, []),
  );

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Header
        title="Home"
        showBackButton={false}
        rightActionIcon="cog"
        onRightActionPress={() => navigation.navigate("Settings")}
      />

      <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: 50 }}>
        {/* Wallet como TEXT, não TextInput — bug #2 do backlog resolvido */}
        <View
          style={[styles.walletCard, { backgroundColor: theme.colors.surface }]}
        >
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Saldo atual
          </Text>
          <Text
            variant="headlineLarge"
            style={{
              fontWeight: "bold",
              color: walletBalance >= 0 ? "#27AE60" : theme.colors.error,
              marginTop: 4,
            }}
          >
            {walletBalance < 0 ? "-" : ""}R${" "}
            {Math.abs(walletBalance).toFixed(2).replace(".", ",")}
          </Text>
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
          data={entries}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <Pressable onLongPress={() => remove(item.id)}>
              <TransactionItem
                title={item.description}
                date={formatarData(item.date)}
                amount={Math.abs(item.value)}
                // type dinâmico baseado no sinal do valor — não mais hardcoded "outcome"
                type={item.value >= 0 ? "income" : "outcome"}
                categoryIcon={DEFAULT_ICON}
              />
            </Pressable>
          )}
          ListEmptyComponent={() => (
            <Text
              style={{
                color: theme.colors.onSurfaceVariant,
                textAlign: "center",
                marginTop: 40,
              }}
            >
              Nenhum lançamento ainda. Toque em + para começar.
            </Text>
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
          style={{ flex: 1 }}
        />
      </View>

      <View style={styles.fabContainer}>
        <Pressable onPress={() => navigation.navigate("NewEntryScreen")}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  walletCard: {
    marginTop: 32,
    marginBottom: 8,
    padding: 24,
    borderRadius: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  fabContainer: {
    width: 67,
    height: 67,
    borderRadius: 35,
    overflow: "hidden",
    backgroundColor: "#1f9be2",
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
    color: "#fff",
    fontSize: 40,
    textAlign: "center",
    marginTop: -5,
  },
});
