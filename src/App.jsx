"use client";

import {
  Billboard,
  Environment,
  OrbitControls,
  PerspectiveCamera,
  Plane,
  useGLTF,
} from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { folder, Leva, useControls } from "leva";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import * as THREE from "three";
import CSM from "three-custom-shader-material/vanilla";
import "./styles.css";

class ToonMaterial extends CSM {
  constructor() {
    super({
      baseMaterial: THREE.MeshStandardMaterial,
      uniforms: {
        uRamp: {
          value: null,
        },
      },
      fragmentShader: /* glsl */ `
      uniform sampler2D uRamp;

      float luma(vec3 color) {
        return dot(color, vec3(0.299, 0.587, 0.114));
      }

      vec3 colorRamp(float t, sampler2D ramp) {
        vec2 uv = vec2(t, 0.0);
        vec3 col = texture2D(ramp, uv).rgb;
        return col;
      }


      vec3 getToonColor(vec3 diffuse) {
        float factor = luma(diffuse);
        factor = clamp(factor, 0.0, 1.0);

        vec3 color = colorRamp(factor, uRamp);
        return color;
      }
    `,
      patchMap: {
        "*": {
          "#include <opaque_fragment>": `
          #include <opaque_fragment>
          gl_FragColor = vec4( getToonColor(outgoingLight), diffuseColor.a );
        `,
        },
      },
      envMapIntensity: 0.4,
    });
  }

  set uRamp(steps) {
    this.uniforms.uRamp.value?.dispose();
    this.uniforms.uRamp.value = this.getConstantRamp(steps);
  }

  get uRamp() {
    return this.uniforms.uRamp.value;
  }

  getConstantRamp(stops) {
    const arr = [];
    const color = new THREE.Color();

    // Sort the stops by position
    const sorted = [...stops].sort((a, b) => a.pos - b.pos);

    for (let i = 0; i < 1; i++) {
      for (let j = 0; j < 256; j++) {
        let position = j / 256;
        const stop = sorted.reduce((prev, curr) => {
          if (curr.pos <= position && curr.pos > prev.pos) {
            return curr;
          }
          return prev;
        });

        if (stop) {
          color.set(stop.color);
          arr.push(color.r * 255, color.g * 255, color.b * 255, 255);
        }
      }
    }

    const texture = new THREE.DataTexture(
      new Uint8Array(arr), //
      256,
      1
    );
    texture.needsUpdate = true;
    return texture;
  }
}

function Thing() {
  const { scene } = useGLTF("/demo-2023-toon-shader/monkeys.glb");
  const material = useMemo(() => new ToonMaterial(), []);

  const [steps, setSteps] = useState([
    { color: "#344541", pos: 0 },
    { color: "#38574d", pos: 0.1 },
    { color: "#7FAE58", pos: 0.36 },
    { color: "#CDE583", pos: 0.82 },
  ]);

  useEffect(() => {
    material.uRamp = steps;
  }, [material, steps]);

  useControls(() => {
    const obj = {};

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      obj[`Step-${i}`] = folder({
        [`position-${i}`]: {
          value: step.pos,
          min: 0,
          max: 1,
          step: 0.001,
          onChange: (v) => {
            setSteps((s) => {
              const clone = [...s];
              clone[i].pos = v;
              return clone;
            });
          },
        },
        [`color-${i}`]: {
          value: step.color,
          onChange: (col) => {
            setSteps((s) => {
              const clone = [...s];
              clone[i].color = col;
              return clone;
            });
          },
        },
      });
    }

    return obj;
  }, []);

  useLayoutEffect(() => {
    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.material = material;
      }
    });

    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <>
      <Billboard>
        <Plane position={[0, 2, 0]} key={JSON.stringify(steps)}>
          <meshBasicMaterial map={material.uRamp} />
        </Plane>
      </Billboard>
      <primitive object={scene} />;
    </>
  );
}

export default function App() {
  return (
    <>
      <Canvas shadows>
        <fog attach="fog" args={[0xffffff, 10, 90]} />

        <OrbitControls makeDefault />
        <PerspectiveCamera fov={39.6} position={[0, 2, 10]} makeDefault />

        <Environment
          background
          blur={0.05}
          files={"/demo-2023-toon-shader/table_mountain_2_puresky_1k.hdr"}
        />
        <Thing />
      </Canvas>

      <Leva collapsed />
    </>
  );
}
