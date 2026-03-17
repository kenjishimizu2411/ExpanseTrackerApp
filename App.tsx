import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SQLiteProvider, type SQLiteDatabase } from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";

import { lightTheme, darkTheme } from "./src/theme";
import { HomeScreen } from "./src/screens/HomeScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { NewEntryScreen } from "./src/screens/NewEntryScreen";
import ManageCategoriesScreen from "./src/screens/ManageCategoriesScreen";
import {
  PreferencesProvider,
  usePreferences,
} from "./src/contexts/PreferencesContext";
import * as schema from "./src/database/schemas/productSchema";

const Stack = createNativeStackNavigator();

// Seed das categorias nativas.
// Cada categoria já inclui o ícone e o createdAt.
// O timestamp é fixo e ordenado para garantir a sequência de exibição na ManageScreen.
const NATIVE_CATEGORIES = [
  // ── Despesas ─────────────────────────────────────────────────────────
  {
    name: "Alimentação",
    color: "#FF6B6B",
    isIncome: false,
    icon: "silverware-fork-knife",
    createdAt: "2025-01-01T00:00:00.000Z",
  },
  {
    name: "Transporte",
    color: "#4ECDC4",
    isIncome: false,
    icon: "bus",
    createdAt: "2025-01-01T00:00:01.000Z",
  },
  {
    name: "Entretenimento",
    color: "#45B7D1",
    isIncome: false,
    icon: "party-popper",
    createdAt: "2025-01-01T00:00:02.000Z",
  },
  {
    name: "Compras",
    color: "#96CEB4",
    isIncome: false,
    icon: "shopping",
    createdAt: "2025-01-01T00:00:03.000Z",
  },
  {
    name: "Contas",
    color: "#FFEAA7",
    isIncome: false,
    icon: "file-document-outline",
    createdAt: "2025-01-01T00:00:04.000Z",
  },
  {
    name: "Saúde",
    color: "#FF8A80",
    isIncome: false,
    icon: "hospital-box-outline",
    createdAt: "2025-01-01T00:00:05.000Z",
  },
  // ── Receitas ─────────────────────────────────────────────────────────
  {
    name: "Salário",
    color: "#2ECC71",
    isIncome: true,
    icon: "cash",
    createdAt: "2025-01-01T00:00:06.000Z",
  },
  {
    name: "Freelance",
    color: "#27AE60",
    isIncome: true,
    icon: "laptop",
    createdAt: "2025-01-01T00:00:07.000Z",
  },
];

async function initializeDatabase(db: SQLiteDatabase) {
  try {
    // CREATE TABLE IF NOT EXISTS = idempotente: não quebra se as tabelas já existirem.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        color      TEXT    NOT NULL,
        is_income  INTEGER NOT NULL DEFAULT 0,
        icon       TEXT    NOT NULL DEFAULT 'dots-horizontal',
        created_at TEXT    NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS entries (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT    NOT NULL,
        category_id INTEGER,
        date        TEXT    NOT NULL,
        value       REAL    NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );

      CREATE TABLE IF NOT EXISTS wallets (
        id    INTEGER PRIMARY KEY AUTOINCREMENT,
        value REAL    NOT NULL
      );
    `);

    // ── Migração para bancos existentes ──────────────────────────────
    // ALTER TABLE ADD COLUMN falha se a coluna já existe.
    // O try/catch individual em cada comando permite ignorar esse erro
    // sem precisar de um sistema de migrations completo (adequado para MVP).
    const migrations = [
      `ALTER TABLE categories ADD COLUMN icon       TEXT NOT NULL DEFAULT 'dots-horizontal'`,
      `ALTER TABLE categories ADD COLUMN created_at TEXT NOT NULL DEFAULT ''`,
    ];
    for (const sql of migrations) {
      try {
        await db.execAsync(sql);
      } catch (_) {
        /* coluna já existe */
      }
    }

    // ── Seed ─────────────────────────────────────────────────────────
    // Só insere categorias se o banco estiver vazio (primeira execução).
    const drizzleDb = drizzle(db, { schema });
    const existing = await drizzleDb.select().from(schema.category).limit(1);
    if (existing.length === 0) {
      await drizzleDb.insert(schema.category).values(NATIVE_CATEGORIES);
    }

    // Wallet sempre existe com id=1
    const wallet = await drizzleDb.select().from(schema.wallet).limit(1);
    if (wallet.length === 0) {
      await drizzleDb.insert(schema.wallet).values({ id: 1, value: 0 });
    }

    console.log("Banco inicializado com sucesso.");
  } catch (error) {
    console.error("Erro ao inicializar o banco:", error);
    throw error;
  }
}

function AppContent() {
  const { isThemeDark } = usePreferences();
  const theme = isThemeDark ? darkTheme : lightTheme;

  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="NewEntryScreen"
            component={NewEntryScreen}
            options={{ title: "Novo Lançamento", presentation: "modal" }}
          />
          <Stack.Screen
            name="ManageCategories"
            component={ManageCategoriesScreen}
            options={{ title: "Gerir Categorias" }}
          />
        </Stack.Navigator>
        <StatusBar style={isThemeDark ? "light" : "dark"} />
      </NavigationContainer>
    </PaperProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <SQLiteProvider
          databaseName="products_v2.db"
          onInit={initializeDatabase}
          useSuspense
        >
          <AppContent />
        </SQLiteProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
