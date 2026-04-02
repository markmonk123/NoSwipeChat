import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const getBandOffset = (index, size) => {
  const band = (index % 5) - 2;
  return band * size * 0.068;
};

const getBandRadius = (index, radius) => {
  const band = Math.abs((index % 5) - 2);
  return radius * (1 - band * 0.16);
};

const getDotColor = (value) => {
  if (value >= 0.7) {
    return '#f04c3e';
  }

  if (value >= 0.45) {
    return '#f39a4c';
  }

  return '#ffd28b';
};

const buildNodes = (vector, size) => {
  const safeVector = Array.isArray(vector) && vector.length > 0 ? vector : [0.5];
  const count = safeVector.length;
  const baseRadius = size * 0.33;

  return safeVector.map((entry, index) => {
    const value = clamp01(entry);
    const angle = (index / count) * Math.PI * 2;
    const bandRadius = getBandRadius(index, baseRadius);
    const x = Math.cos(angle) * bandRadius;
    const y = Math.sin(angle) * bandRadius * 0.34 + getBandOffset(index, size);
    const dotSize = 7 + value * 11;

    return {
      key: `personality-node-${index}`,
      color: getDotColor(value),
      opacity: 0.45 + value * 0.55,
      size: dotSize,
      x,
      y
    };
  });
};

const PersonalityOrb = ({ vector = [], size = 220 }) => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 16000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );

    animation.start();

    return () => {
      animation.stop();
      rotation.stopAnimation();
    };
  }, [rotation]);

  const average = useMemo(() => {
    if (!Array.isArray(vector) || vector.length === 0) {
      return 0;
    }

    return Math.round(
      vector.reduce((total, entry) => total + clamp01(entry), 0) / vector.length * 100
    );
  }, [vector]);

  const nodes = useMemo(() => buildNodes(vector, size), [size, vector]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const counterSpin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg']
  });

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <View
        style={[
          styles.shell,
          {
            width: size,
            height: size,
            borderRadius: size / 2
          }
        ]}
      >
        <View
          style={[
            styles.coreGlow,
            {
              width: size * 0.68,
              height: size * 0.68,
              borderRadius: size * 0.34
            }
          ]}
        />
        <View
          style={[
            styles.topHighlight,
            {
              width: size * 0.36,
              height: size * 0.16,
              borderRadius: size * 0.08
            }
          ]}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.spinLayer,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              transform: [{ perspective: 900 }, { rotateY: spin }]
            }
          ]}
        >
          <View
            style={[
              styles.orbit,
              {
                width: size * 0.82,
                height: size * 0.82,
                borderRadius: size * 0.41
              }
            ]}
          />
          <View
            style={[
              styles.orbit,
              styles.orbitFlat,
              {
                width: size * 0.82,
                height: size * 0.82,
                borderRadius: size * 0.41
              }
            ]}
          />
          <View
            style={[
              styles.orbit,
              styles.orbitTiltedLeft,
              {
                width: size * 0.78,
                height: size * 0.78,
                borderRadius: size * 0.39
              }
            ]}
          />
          <View
            style={[
              styles.orbit,
              styles.orbitTiltedRight,
              {
                width: size * 0.78,
                height: size * 0.78,
                borderRadius: size * 0.39
              }
            ]}
          />

          {nodes.map((node) => (
            <View
              key={node.key}
              style={[
                styles.node,
                {
                  width: node.size,
                  height: node.size,
                  borderRadius: node.size / 2,
                  backgroundColor: node.color,
                  opacity: node.opacity,
                  left: size / 2 + node.x - node.size / 2,
                  top: size / 2 + node.y - node.size / 2
                }
              ]}
            />
          ))}
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.badge,
            {
              width: size * 0.34,
              height: size * 0.34,
              borderRadius: size * 0.17,
              transform: [{ rotate: counterSpin }]
            }
          ]}
        >
          <Text style={styles.badgeValue}>{average}%</Text>
          <Text style={styles.badgeLabel}>{vector.length || 35}D sync</Text>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#2b1714',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#d55d43',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 16
    },
    elevation: 10
  },
  coreGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(240, 76, 62, 0.18)'
  },
  topHighlight: {
    position: 'absolute',
    top: '14%',
    backgroundColor: 'rgba(255,255,255,0.14)',
    transform: [{ rotate: '-8deg' }]
  },
  spinLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center'
  },
  orbit: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 174, 0.26)'
  },
  orbitFlat: {
    transform: [{ scaleY: 0.35 }]
  },
  orbitTiltedLeft: {
    transform: [{ rotate: '62deg' }, { scaleY: 0.34 }]
  },
  orbitTiltedRight: {
    transform: [{ rotate: '-62deg' }, { scaleY: 0.34 }]
  },
  node: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)'
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22, 15, 14, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  badgeValue: {
    color: '#fffaf7',
    fontSize: 22,
    fontWeight: '800'
  },
  badgeLabel: {
    marginTop: 4,
    color: '#f9c7b0',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1
  }
});

export default PersonalityOrb;
