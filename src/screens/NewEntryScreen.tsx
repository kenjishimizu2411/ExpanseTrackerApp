import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";
import { Text, Button, TextInput, Icon, useTheme } from "react-native-paper";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSQLiteContext } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { eq, sql } from "drizzle-orm";

import * as schema from "../database/schemas/productSchema";
import { InputAmount } from "../components/index";

type Category = typeof schema.category.$inferSelect;

// ── Cores semânticas centralizadas ────────────────────────────────────────
// Definir aqui evita que income/outcome tenham cores diferentes em cada tela.
// income  = verde  (#27AE60 fundo, #1A7A45 texto escuro)
// outcome = vermelho via theme.colors.error (se adapta ao dark mode)
const INCOME_COLOR = "#27AE60";
const INCOME_BG = "#D5F5E3";
const INCOME_TEXT = "#1A7A45";

interface NewEntryScreenProps {
  navigation: any;
}

export function NewEntryScreen({ navigation }: NewEntryScreenProps) {
  const theme = useTheme();
  const database = useSQLiteContext();
  const db = useMemo(() => drizzle(database, { schema }), [database]);

  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ── Categorias ────────────────────────────────────────────────────────
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [showAllModal, setShowAllModal] = useState(false);

  // Top 5: as 5 mais usadas em lançamentos (contagem de entries por category_id).
  // Se uma categoria nunca foi usada, não aparece no top — por isso mantemos
  // as nativas com prioridade no seed, e complementamos com as primeiras do banco.
  const [topCategories, setTopCategories] = useState<Category[]>([]);

  // ── Wallet ────────────────────────────────────────────────────────────
  const [walletValue, setWalletValue] = useState(0);
  const [walletExists, setWalletExists] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    try {
      // 1. Todas as categorias do banco
      const cats = await db.select().from(schema.category);
      setAllCategories(cats);

      // 2. Top 5 por frequência de uso
      // Fazemos um LEFT JOIN de categories → entries e contamos quantas entries
      // cada categoria tem. As 5 com mais uso ficam no topo da NewEntry.
      // Se uma categoria nunca foi usada, ela entra com count=0 e fica no final.
      const usageCounts = await db
        .select({
          categoryId: schema.entry.categoryId,
          count: sql<number>`COUNT(${schema.entry.id})`,
        })
        .from(schema.entry)
        .groupBy(schema.entry.categoryId);

      // Monta um mapa { categoryId → count } para lookup rápido
      const countMap: Record<number, number> = {};
      for (const row of usageCounts) {
        if (row.categoryId != null) countMap[row.categoryId] = row.count;
      }

      // Ordena todas as categorias por uso decrescente, depois pega as 5 primeiras
      const sorted = [...cats].sort(
        (a, b) => (countMap[b.id] ?? 0) - (countMap[a.id] ?? 0),
      );
      setTopCategories(sorted.slice(0, 5));

      // Pré-seleciona a primeira do top
      if (sorted.length > 0) setSelectedCategory(sorted[0]);

      // 3. Wallet
      const walletRow = await db.select().from(schema.wallet).limit(1);
      if (walletRow.length > 0) {
        setWalletValue(walletRow[0].value);
        setWalletExists(true);
      }
    } catch (error) {
      console.error("Erro ao carregar dados iniciais:", error);
    }
  }

  const onChangeDate = (_: any, selected?: Date) => {
    setShowDatePicker(false);
    if (selected) setDate(selected);
  };

  const handleSave = async () => {
    if (!amount || amount <= 0) {
      Alert.alert("Atenção", "Informe um valor válido.");
      return;
    }
    if (!selectedCategory) {
      Alert.alert("Atenção", "Selecione uma categoria.");
      return;
    }

    try {
      // isIncome da categoria define o sinal: receita = positivo, despesa = negativo
      const finalAmount = selectedCategory.isIncome ? amount : -amount;

      await db.insert(schema.entry).values({
        description: description.trim() || selectedCategory.name,
        categoryId: selectedCategory.id,
        date: date.toISOString(),
        value: finalAmount,
      });

      if (walletExists) {
        await db
          .update(schema.wallet)
          .set({ value: walletValue + finalAmount })
          .where(eq(schema.wallet.id, 1));
      } else {
        await db.insert(schema.wallet).values({ id: 1, value: finalAmount });
      }

      Alert.alert(
        "Sucesso",
        `${selectedCategory.isIncome ? "Receita" : "Despesa"} salva!`,
      );
      navigation.goBack();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      Alert.alert("Erro", "Não foi possível salvar o lançamento.");
    }
  };

  // ── Cores do card de categoria baseadas em isIncome ───────────────────
  // Centralizar aqui garante que o mesmo padrão visual se aplica no top 5
  // e no modal de "todas as categorias".
  function cardColors(cat: Category, isSelected: boolean) {
    if (!isSelected) {
      return {
        border: theme.colors.outline,
        background: theme.colors.surface,
        icon: theme.colors.onSurface,
        text: theme.colors.onSurface,
      };
    }
    if (cat.isIncome) {
      return {
        border: INCOME_COLOR,
        background: theme.dark ? "#1A3D2B" : INCOME_BG,
        icon: INCOME_COLOR,
        text: theme.dark ? "#A8E6CF" : INCOME_TEXT,
      };
    }
    // Despesa selecionada: usa as cores de erro do tema (funciona em dark/light)
    return {
      border: theme.colors.error,
      background: theme.colors.errorContainer,
      icon: theme.colors.error,
      text: theme.colors.onErrorContainer,
    };
  }

  function CategoryCard({
    cat,
    compact = false,
  }: {
    cat: Category;
    compact?: boolean;
  }) {
    const isSelected = selectedCategory?.id === cat.id;
    const colors = cardColors(cat, isSelected);

    return (
      <TouchableOpacity
        style={[
          compact ? styles.modalCard : styles.card,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
        onPress={() => {
          setSelectedCategory(cat);
          setShowAllModal(false);
        }}
      >
        <Icon source={cat.icon} size={20} color={colors.icon} />
        <Text
          style={[
            styles.cardText,
            { color: colors.text, marginLeft: 8 },
            isSelected && { fontWeight: "bold" },
          ]}
          numberOfLines={1}
        >
          {cat.name}
        </Text>
      </TouchableOpacity>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Valor */}
      <View style={styles.amountContainer}>
        <InputAmount value={amount} onChangeValue={setAmount} />
      </View>

      {/* Título da seção de categorias */}
      <Text
        variant="titleMedium"
        style={[styles.sectionTitle, { color: theme.colors.onBackground }]}
      >
        Categoria
      </Text>

      {allCategories.length === 0 ? (
        <Text
          style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}
        >
          Nenhuma categoria disponível. Crie uma em Ajustes → Categorias.
        </Text>
      ) : (
        <>
          {/* Grid das top 5 categorias mais usadas */}
          <View style={styles.gridContainer}>
            {topCategories.map((cat) => (
              <CategoryCard key={cat.id} cat={cat} />
            ))}
          </View>

          {/* Botão "Ver todas" — só aparece se houver mais de 5 categorias */}
          {allCategories.length > 5 && (
            <TouchableOpacity
              style={[
                styles.viewAllButton,
                { borderColor: theme.colors.outline },
              ]}
              onPress={() => setShowAllModal(true)}
            >
              <Icon
                source="view-grid-outline"
                size={16}
                color={theme.colors.primary}
              />
              <Text
                style={[styles.viewAllText, { color: theme.colors.primary }]}
              >
                Ver todas as categorias ({allCategories.length})
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* Badge de tipo — indica receita ou despesa com base na categoria selecionada */}
      {selectedCategory && (
        <View
          style={[
            styles.typeBadge,
            {
              backgroundColor: selectedCategory.isIncome
                ? theme.dark
                  ? "#1A3D2B"
                  : INCOME_BG
                : theme.colors.errorContainer,
            },
          ]}
        >
          <Icon
            source={
              selectedCategory.isIncome
                ? "arrow-down-circle"
                : "arrow-up-circle"
            }
            size={14}
            color={
              selectedCategory.isIncome
                ? theme.dark
                  ? "#A8E6CF"
                  : INCOME_TEXT
                : theme.colors.error
            }
          />
          <Text
            style={{
              color: selectedCategory.isIncome
                ? theme.dark
                  ? "#A8E6CF"
                  : INCOME_TEXT
                : theme.colors.onErrorContainer,
              fontWeight: "600",
              fontSize: 13,
              marginLeft: 6,
            }}
          >
            {selectedCategory.isIncome
              ? "Receita — será somado ao saldo"
              : "Despesa — será subtraído do saldo"}
          </Text>
        </View>
      )}

      {/* Campos de data e descrição */}
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
          placeholder="ex: Lanche com os amigos (opcional)"
          placeholderTextColor={theme.colors.onSurfaceDisabled}
          value={description}
          onChangeText={setDescription}
          style={[styles.inputField, { backgroundColor: theme.colors.surface }]}
          outlineStyle={styles.inputOutline}
        />
      </View>

      {/* Botão de salvar — cor muda com o tipo */}
      <Button
        mode="contained"
        onPress={handleSave}
        buttonColor={
          selectedCategory?.isIncome ? INCOME_COLOR : theme.colors.primary
        }
        textColor="#FFF"
        contentStyle={{ height: 56 }}
        style={styles.saveButton}
      >
        {selectedCategory?.isIncome ? "Salvar Receita" : "Salvar Despesa"}
      </Button>

      {/* ── Modal "Ver todas as categorias" ──────────────────────────── */}
      {/* Modal é um overlay nativo — não bloqueia o ScrollView principal */}
      <Modal
        visible={showAllModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAllModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            {/* Cabeçalho do modal */}
            <View style={styles.modalHeader}>
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.onSurface, fontWeight: "bold" }}
              >
                Todas as categorias
              </Text>
              <TouchableOpacity onPress={() => setShowAllModal(false)}>
                <Icon source="close" size={24} color={theme.colors.onSurface} />
              </TouchableOpacity>
            </View>

            {/* Lista completa em grid de 3 colunas */}
            <FlatList
              data={allCategories}
              keyExtractor={(item) => String(item.id)}
              numColumns={3}
              columnWrapperStyle={styles.modalRow}
              contentContainerStyle={styles.modalList}
              renderItem={({ item }) => <CategoryCard cat={item} compact />}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  amountContainer: { alignItems: "center", marginTop: 20 },
  sectionTitle: { fontWeight: "bold", marginBottom: 10, marginTop: 20 },

  // Grid top 5
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
    borderWidth: 1.5,
  },

  // Botão "Ver todas"
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  viewAllText: { fontSize: 13, fontWeight: "600" },

  // Badge de tipo
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
    alignSelf: "flex-start",
  },

  // Inputs
  inputsSection: { gap: 15, marginTop: 10 },
  label: { fontSize: 14, marginBottom: 5, fontWeight: "600" },
  inputField: { fontSize: 16 },
  inputOutline: { borderRadius: 12, borderColor: "#E0E0E0" },
  saveButton: { marginVertical: 30, borderRadius: 12, marginBottom: 60 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    maxHeight: "75%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  modalList: { paddingHorizontal: 12, paddingBottom: 40 },
  modalRow: { gap: 8, marginBottom: 8 },
  modalCard: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    gap: 6,
  },
  cardText: { fontSize: 12, fontWeight: "500", flex: 1 },
});
