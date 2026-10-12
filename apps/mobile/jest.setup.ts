// Mock oficial de AsyncStorage para Jest (no hay módulo nativo en Node).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
