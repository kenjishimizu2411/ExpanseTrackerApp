import React from "react";
import { View, StyleSheet, ScrollView, Alert, Image } from "react-native";
import {
  Text,
  Avatar,
  List,
  Switch,
  Button,
  Divider,
  useTheme,
} from "react-native-paper";
import { Header } from "../components";
import { usePreferences } from "../contexts/PreferencesContext";
import Rise2GetherLogo from "../utils/logo.png";

interface SettingsScreenProps {
  navigation: any;
}

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const theme = useTheme();
  const { isThemeDark, toggleTheme } = usePreferences();

  const handleWipeData = () => {
    Alert.alert(
      "Zona de Perigo",
      "Tem certeza que deseja apagar TODOS os dados? Essa ação é irreversível.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sim, Apagar",
          style: "destructive",
          onPress: () => console.log("Apagando..."),
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Header
        title="Ajustes"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profileSection}>
          <Avatar.Text
            size={80}
            label="DA"
            style={{ backgroundColor: theme.colors.primary }}
          />
          <Text
            variant="titleLarge"
            style={[styles.name, { color: theme.colors.onBackground }]}
          >
            Dev Account
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.secondary }}>
            Rise2Gethers - CTO
          </Text>

          {/* Logo da empresa — discreta, abaixo do cargo */}
          <Image
            source={Rise2GetherLogo}
            style={styles.companyLogo}
            resizeMode="contain"
          />
        </View>

        <Divider style={styles.divider} />

        <List.Section>
          <List.Subheader>Preferências</List.Subheader>

          <List.Item
            title="Tema Escuro"
            description="Alternar entre Light e Dark mode"
            left={(props) => <List.Icon {...props} icon="theme-light-dark" />}
            right={() => (
              <Switch value={isThemeDark} onValueChange={toggleTheme} />
            )}
          />

          <List.Item
            title="Categorias"
            description="Gerenciar categorias de gastos"
            left={(props) => <List.Icon {...props} icon="shape-outline" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => navigation.navigate("ManageCategories")}
          />
        </List.Section>

        <Divider style={styles.divider} />

        <List.Section>
          <List.Subheader style={{ color: theme.colors.error }}>
            Zona de Perigo
          </List.Subheader>

          <Button
            mode="outlined"
            textColor={theme.colors.error}
            style={{ borderColor: theme.colors.error, marginHorizontal: 16 }}
            icon="delete-outline"
            onPress={handleWipeData}
          >
            Apagar Todos os Dados
          </Button>

          <Text style={styles.versionText}>Versão 1.0.0 (MVP)</Text>
        </List.Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 30,
  },
  name: {
    fontWeight: "bold",
    marginTop: 10,
  },
  divider: {
    marginVertical: 10,
  },
  // Logo pequena e com opacidade reduzida para não competir com o perfil.
  // resizeMode="contain" garante que a proporção original é preservada
  // independente do tamanho do container.
  companyLogo: {
    width: 48,
    height: 48,
    marginTop: 16,
    opacity: 0.75,
  },
  versionText: {
    textAlign: "center",
    marginTop: 20,
    color: "#aaa",
    fontSize: 12,
  },
});
