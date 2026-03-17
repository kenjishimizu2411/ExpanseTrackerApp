import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  SectionList,
  Alert,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import {
  Text,
  TextInput,
  Button,
  List,
  Divider,
  SegmentedButtons,
  useTheme,
  Icon,
} from "react-native-paper";
import { useSQLiteContext } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { asc, eq } from "drizzle-orm";
import { useFocusEffect } from "@react-navigation/native";

import * as schema from "../database/schemas/productSchema";

// Tipo derivado do schema — TypeScript vai reclamar automaticamente
// se o schema mudar e este tipo ficar desatualizado.
type Category = typeof schema.category.$inferSelect;

// ── Grid de ícones disponíveis para seleção ────────────────────────────────
// O usuário escolhe visualmente. O valor armazenado no banco é apenas o "name"
// (string), que o componente <Icon source={name}> do Paper sabe renderizar.
const AVAILABLE_ICONS = [
  { name: "silverware-fork-knife", label: "Alimentação" },
  { name: "bus", label: "Transporte" },
  { name: "shopping", label: "Compras" },
  { name: "party-popper", label: "Lazer" },
  { name: "file-document-outline", label: "Contas" },
  { name: "hospital-box-outline", label: "Saúde" },
  { name: "cash", label: "Dinheiro" },
  { name: "laptop", label: "Trabalho" },
  { name: "home-outline", label: "Casa" },
  { name: "school-outline", label: "Educação" },
  { name: "dumbbell", label: "Academia" },
  { name: "airplane", label: "Viagem" },
  { name: "gift-outline", label: "Presente" },
  { name: "heart-outline", label: "Saúde" },
  { name: "coffee-outline", label: "Café" },
  { name: "music-note", label: "Música" },
  { name: "paw", label: "Pet" },
  { name: "fuel", label: "Combustível" },
  { name: "dots-horizontal", label: "Outro" },
  { name: "plus-circle-outline", label: "Novo" },
];

export default function ManageCategoriesScreen() {
  const database = useSQLiteContext();
  // useMemo: o objeto drizzle é criado uma vez e reutilizado entre renders.
  // Sem isso, um novo objeto seria instanciado a cada re-render da tela.
  const db = useMemo(() => drizzle(database, { schema }), [database]);
  const theme = useTheme();

  // ── Estado do formulário ───────────────────────────────────────────────
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("dots-horizontal");
  // SegmentedButtons trabalha com string, não boolean
  const [incomeType, setIncomeType] = useState<"false" | "true">("false");
  const [isLoading, setIsLoading] = useState(false);

  // ── Estado da lista ────────────────────────────────────────────────────
  // SectionList exige dados no formato [{ title, data }]
  // Dois grupos: Despesas e Receitas, cada um ordenado por createdAt
  const [sections, setSections] = useState<
    { title: string; data: Category[] }[]
  >([]);

  // useFocusEffect: recarrega a lista toda vez que o usuário retorna a esta tela
  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, []),
  );

  async function fetchCategories() {
    try {
      // Busca todas as categorias ordenadas por data de criação
      const data = await db
        .select()
        .from(schema.category)
        .orderBy(asc(schema.category.createdAt));

      // Separa em dois grupos para o SectionList
      const despesas = data.filter((c) => !c.isIncome);
      const receitas = data.filter((c) => c.isIncome);

      // Só mostra a seção se tiver itens — evita cabeçalho de seção vazio
      const result = [];
      if (despesas.length > 0)
        result.push({ title: "Despesas", data: despesas });
      if (receitas.length > 0)
        result.push({ title: "Receitas", data: receitas });
      setSections(result);
    } catch (error) {
      console.error("Erro ao buscar categorias:", error);
    }
  }

  async function handleAdd() {
    if (!name.trim()) {
      Alert.alert("Atenção", "O nome da categoria não pode ser vazio.");
      return;
    }
    setIsLoading(true);
    try {
      await db.insert(schema.category).values({
        name: name.trim(),
        color: incomeType === "true" ? "#2ECC71" : "#E74C3C",
        isIncome: incomeType === "true",
        icon: selectedIcon,
        // ISO 8601 com Date.now() para ordenar novas categorias após as nativas
        createdAt: new Date().toISOString(),
      });
      // Limpa o formulário após salvar
      setName("");
      setSelectedIcon("dots-horizontal");
      setIncomeType("false");
      await fetchCategories();
    } catch (error) {
      console.error("Erro ao criar categoria:", error);
      Alert.alert("Erro", "Não foi possível salvar a categoria.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(cat: Category) {
    // Verifica se há lançamentos vinculados antes de apagar
    const linked = await db
      .select()
      .from(schema.entry)
      .where(eq(schema.entry.categoryId, cat.id))
      .limit(1);

    const msg =
      linked.length > 0
        ? `"${cat.name}" possui lançamentos. Eles ficarão sem categoria. Continuar?`
        : `Apagar a categoria "${cat.name}"?`;

    Alert.alert("Apagar categoria", msg, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          try {
            await db
              .delete(schema.category)
              .where(eq(schema.category.id, cat.id));
            await fetchCategories();
          } catch (err) {
            console.error("Erro ao apagar:", err);
            Alert.alert("Erro", "Não foi possível apagar a categoria.");
          }
        },
      },
    ]);
  }

  // ── Cores semânticas ajustadas para dark mode ──────────────────────────
  // Problema original: "#2ECC71" hardcoded ficava invisível sobre fundo escuro.
  // Solução: usamos as cores do tema para containers e texto, e só usamos
  // verde/vermelho fixo no ícone (que contrasta bem em qualquer fundo).
  function getTypeColors(isIncome: boolean) {
    if (isIncome) {
      return {
        iconColor: "#2ECC71",
        labelColor: theme.dark ? "#A8E6CF" : "#1A7A45", // verde claro no dark, escuro no light
      };
    }
    return {
      iconColor: theme.colors.error,
      labelColor: theme.colors.error,
    };
  }

  // ── Renderização de cada item da lista ────────────────────────────────
  function renderItem({ item }: { item: Category }) {
    const { iconColor, labelColor } = getTypeColors(item.isIncome);
    return (
      <>
        <List.Item
          title={item.name}
          titleStyle={{ color: theme.colors.onSurface, fontWeight: "600" }}
          description={item.isIncome ? "Receita (+)" : "Despesa (-)"}
          descriptionStyle={{ color: labelColor, fontWeight: "500" }}
          left={() => (
            // Círculo colorido com o ícone da categoria
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: theme.colors.elevation.level3 },
              ]}
            >
              <Icon source={item.icon} size={20} color={iconColor} />
            </View>
          )}
          right={() => (
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              style={styles.deleteBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon
                source="trash-can-outline"
                size={20}
                color={theme.colors.error}
              />
            </TouchableOpacity>
          )}
          style={{ backgroundColor: theme.colors.surface }}
        />
        <Divider />
      </>
    );
  }

  // ── Cabeçalho de cada seção (Despesas / Receitas) ─────────────────────
  function renderSectionHeader({ section }: { section: { title: string } }) {
    const isReceita = section.title === "Receitas";
    return (
      <View
        style={[
          styles.sectionHeader,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Icon
          source={isReceita ? "arrow-down-circle" : "arrow-up-circle"}
          size={16}
          color={
            isReceita
              ? theme.dark
                ? "#A8E6CF"
                : "#1A7A45"
              : theme.colors.error
          }
        />
        <Text
          variant="labelLarge"
          style={[
            styles.sectionTitle,
            {
              color: isReceita
                ? theme.dark
                  ? "#A8E6CF"
                  : "#1A7A45"
                : theme.colors.error,
            },
          ]}
        >
          {section.title}
        </Text>
      </View>
    );
  }

  // ── Render principal ──────────────────────────────────────────────────
  return (
    // SectionList não permite elemento pai com scroll — usamos View + SectionList diretamente.
    // O formulário fica dentro do ListHeaderComponent para rolar junto com a lista.
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={true}
        ListHeaderComponent={
          // ── Formulário de criação ──────────────────────────────────
          <View
            style={[
              styles.form,
              {
                backgroundColor: theme.colors.surface,
                borderBottomColor: theme.colors.outline,
              },
            ]}
          >
            <TextInput
              mode="outlined"
              label="Nome da categoria"
              value={name}
              onChangeText={setName}
              style={styles.input}
              outlineStyle={{ borderRadius: 10 }}
            />

            {/* Seletor de tipo: SegmentedButtons com cores semânticas corretas */}
            <Text
              variant="labelMedium"
              style={[
                styles.fieldLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Tipo
            </Text>
            <SegmentedButtons
              value={incomeType}
              onValueChange={(v) => setIncomeType(v as "false" | "true")}
              buttons={[
                {
                  value: "false",
                  label: "Despesa",
                  icon: "arrow-up-circle-outline",
                  // errorContainer é vermelho claro tanto no light quanto no dark — correto para despesa
                  style:
                    incomeType === "false"
                      ? { backgroundColor: theme.colors.errorContainer }
                      : undefined,
                  labelStyle:
                    incomeType === "false"
                      ? { color: theme.colors.onErrorContainer }
                      : undefined,
                },
                {
                  value: "true",
                  label: "Receita",
                  icon: "arrow-down-circle-outline",
                  // surfaceVariant é neutro — funciona bem em ambos os modos
                  style:
                    incomeType === "true"
                      ? { backgroundColor: theme.colors.secondaryContainer }
                      : undefined,
                  labelStyle:
                    incomeType === "true"
                      ? { color: theme.colors.onSecondaryContainer }
                      : undefined,
                },
              ]}
              style={styles.segmented}
            />

            {/* Grid de ícones para seleção */}
            <Text
              variant="labelMedium"
              style={[
                styles.fieldLabel,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Ícone
            </Text>
            {/* ScrollView horizontal dentro do formulário para o grid de ícones */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.iconScroll}
            >
              {AVAILABLE_ICONS.map((ic) => {
                const isSelected = selectedIcon === ic.name;
                return (
                  <TouchableOpacity
                    key={ic.name}
                    onPress={() => setSelectedIcon(ic.name)}
                    style={[
                      styles.iconOption,
                      {
                        // Fundo normal usa o nível 2 de elevação do tema
                        backgroundColor: isSelected
                          ? theme.colors.primaryContainer
                          : theme.colors.elevation.level2,
                        // Borda só aparece no selecionado
                        borderColor: isSelected
                          ? theme.colors.primary
                          : "transparent",
                      },
                    ]}
                  >
                    <Icon
                      source={ic.name}
                      size={22}
                      color={
                        isSelected
                          ? theme.colors.primary
                          : theme.colors.onSurfaceVariant
                      }
                    />
                    <Text
                      style={[
                        styles.iconLabel,
                        {
                          color: isSelected
                            ? theme.colors.primary
                            : theme.colors.onSurfaceVariant,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {ic.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Button
              mode="contained"
              onPress={handleAdd}
              loading={isLoading}
              disabled={isLoading}
              contentStyle={{ height: 48 }}
              style={styles.addButton}
            >
              Adicionar categoria
            </Button>
          </View>
        }
        ListEmptyComponent={
          <Text
            style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            Nenhuma categoria cadastrada.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 40 },
  form: { padding: 20, borderBottomWidth: 1, marginBottom: 8 },
  input: { marginBottom: 16 },
  fieldLabel: { marginBottom: 8 },
  segmented: { marginBottom: 16 },
  iconScroll: { marginBottom: 16, paddingLeft: 3 },
  iconOption: {
    alignItems: "center",
    justifyContent: "center",
    width: 64,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  iconLabel: { fontSize: 10, marginTop: 4, textAlign: "center" },
  addButton: { borderRadius: 10 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTitle: { fontWeight: "700" },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
    alignSelf: "center",
    marginLeft: 8,
  },
  deleteBtn: { justifyContent: "center", alignItems: "center" },
  emptyText: { textAlign: "center", marginTop: 40, fontSize: 14 },
});
