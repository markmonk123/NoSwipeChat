import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

const AppScrollView = ({ children, style, contentContainerStyle, ...scrollProps }) => {
  if (Platform.OS !== 'web') {
    return (
      <ScrollView
        style={style}
        contentContainerStyle={contentContainerStyle}
        {...scrollProps}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.webScrollRoot, style]}>
      <View style={[styles.webScrollContent, contentContainerStyle]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  webScrollRoot: {
    flex: 1,
    minHeight: 0,
    alignSelf: 'stretch',
    overflow: 'auto'
  },
  webScrollContent: {
    minHeight: '100%'
  }
});

export default AppScrollView;