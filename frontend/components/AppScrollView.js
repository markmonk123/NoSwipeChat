import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

const AppScrollView = ({ children, style, contentContainerStyle, ...scrollProps }) => {
  return (
    <ScrollView
      style={[styles.scrollRoot, style]}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      {...scrollProps}
    >
      {children}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollRoot: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1
  }
});

export default AppScrollView;
