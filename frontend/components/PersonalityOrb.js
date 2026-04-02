import React, { useMemo } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';

const DEFAULT_VECTOR_35 = Array.from({ length: 35 }, () => 0.5);

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const buildDirections = (count) => {
  const directions = [];
  const offset = 2 / count;
  const increment = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i += 1) {
    const y = i * offset - 1 + offset / 2;
    const r = Math.sqrt(1 - y * y);
    const phi = i * increment;
    const x = Math.cos(phi) * r;
    const z = Math.sin(phi) * r;
    directions.push(new THREE.Vector3(x, y, z));
  }

  return directions;
};

const createPersonalityMesh = (values, tint) => {
  const count = values.length;
  const directions = buildDirections(count);
  const minLen = 0.45;
  const maxLen = 1.2;

  const linePositions = new Float32Array(count * 2 * 3);
  const pointPositions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const value = clamp01(values[i] ?? 0.5);
    const length = minLen + value * (maxLen - minLen);
    const endpoint = directions[i].clone().multiplyScalar(length);

    linePositions.set([0, 0, 0, endpoint.x, endpoint.y, endpoint.z], i * 6);
    pointPositions.set([endpoint.x, endpoint.y, endpoint.z], i * 3);
  }

  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  const lineMaterial = new THREE.LineBasicMaterial({
    color: tint,
    opacity: 0.55,
    transparent: true
  });
  const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);

  const pointsGeometry = new THREE.BufferGeometry();
  pointsGeometry.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
  const pointsMaterial = new THREE.PointsMaterial({
    color: tint,
    size: 0.05,
    sizeAttenuation: true,
    opacity: 0.9,
    transparent: true
  });
  const points = new THREE.Points(pointsGeometry, pointsMaterial);

  const baseSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 18, 18),
    new THREE.MeshBasicMaterial({
      color: tint,
      wireframe: true,
      opacity: 0.2,
      transparent: true
    })
  );

  return { baseSphere, lineSegments, points };
};

const PersonalityOrb = ({ vector, size = 220, tint = '#FF6B6B' }) => {
  const values = Array.isArray(vector) && vector.length ? vector : DEFAULT_VECTOR_35;
  const renderKey = useMemo(() => values.map((value) => clamp01(value)).join(','), [values]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, styles.webFallback, { width: size, height: size }]}>
        <Text style={styles.webFallbackText}>3D view is available on mobile.</Text>
      </View>
    );
  }

  const onContextCreate = async (gl) => {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);
    renderer.setClearColor(0xffffff, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.z = 3.2;

    const group = new THREE.Group();
    scene.add(group);

    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.9);
    directional.position.set(3, 4, 5);
    scene.add(directional);

    const { baseSphere, lineSegments, points } = createPersonalityMesh(values, tint);
    group.add(baseSphere);
    group.add(lineSegments);
    group.add(points);

    const animate = () => {
      group.rotation.y += 0.004;
      group.rotation.x += 0.002;
      renderer.render(scene, camera);
      gl.endFrameEXP();
      requestAnimationFrame(animate);
    };

    animate();
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <GLView key={renderKey} style={styles.gl} onContextCreate={onContextCreate} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  webFallback: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    backgroundColor: '#fafafa',
    paddingHorizontal: 18
  },
  webFallbackText: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center'
  },
  gl: {
    width: '100%',
    height: '100%'
  }
});

export default PersonalityOrb;
