(function initLanding3D() {
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const heroNode = document.getElementById('hero-3d');
  if (!heroNode) return;

  function showFallback(message) {
    heroNode.classList.add('hero-3d--fallback');
    heroNode.textContent = message;
  }

  const shouldDisableForDevice = reduceMotionQuery.matches || window.matchMedia('(max-width: 540px)').matches;

  if (shouldDisableForDevice) {
    showFallback('3D-Vorschau wurde für bessere Performance auf diesem Gerät reduziert.');
    return;
  }

  function initScene() {
    if (!window.THREE) {
      showFallback('3D-Modul konnte nicht geladen werden.');
      return;
    }

    const THREE = window.THREE;
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(42, heroNode.clientWidth / heroNode.clientHeight, 0.1, 100);
    camera.position.set(0, 0.3, 5.2);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(heroNode.clientWidth, heroNode.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    heroNode.innerHTML = '';
    heroNode.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x75add4, 0.9);
    const directional = new THREE.DirectionalLight(0xbba3ff, 1.1);
    directional.position.set(2, 4, 3);
    scene.add(ambient, directional);

    const coreGeometry = new THREE.IcosahedronGeometry(1.12, 1);
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x6f5bdb,
      emissive: 0x113355,
      roughness: 0.38,
      metalness: 0.62
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(core);

    const ringGeometry = new THREE.TorusGeometry(1.7, 0.07, 24, 120);
    const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x38a2b5, roughness: 0.25, metalness: 0.8 });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2.3;
    scene.add(ring);

    const mouse = { x: 0, y: 0 };

    function onPointerMove(event) {
      const rect = heroNode.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width - 0.5) * 0.5;
      mouse.y = ((event.clientY - rect.top) / rect.height - 0.5) * 0.45;
    }

    heroNode.addEventListener('pointermove', onPointerMove);

    let rafId = null;
    const clock = new THREE.Clock();

    function animate() {
      const elapsed = clock.getElapsedTime();
      core.rotation.x = elapsed * 0.18 + mouse.y;
      core.rotation.y = elapsed * 0.32 + mouse.x;
      ring.rotation.z = elapsed * 0.22;
      ring.position.x += (mouse.x * 0.55 - ring.position.x) * 0.04;
      ring.position.y += (-mouse.y * 0.42 - ring.position.y) * 0.04;

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    }

    animate();

    function handleResize() {
      const width = heroNode.clientWidth;
      const height = heroNode.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    window.addEventListener('resize', handleResize);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      } else if (!document.hidden && !rafId) {
        animate();
      }
    });
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(initScene, { timeout: 1200 });
  } else {
    window.setTimeout(initScene, 180);
  }
})();
