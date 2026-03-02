// Mock for react-native in Jest tests
module.exports = {
  StyleSheet: {
    create: (styles) => styles,
  },
  Platform: {
    OS: "ios",
    select: (obj) => obj.ios || obj.default,
  },
  Dimensions: {
    get: () => ({
      width: 375,
      height: 812,
    }),
  },
  View: "View",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  Image: "Image",
  ScrollView: "ScrollView",
  FlatList: "FlatList",
  ActivityIndicator: "ActivityIndicator",
  TextInput: "TextInput",
  Alert: {
    alert: jest.fn(),
  },
};
