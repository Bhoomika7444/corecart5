/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from "react";

interface Node {
  id: string;
  name: string;
  category: "THEME" | "PRODUCT" | "RULE" | "LAYOUT" | "PAYMENT" | "CUSTOMER";
  x: number;
  y: number;
  z: number; // For 3D projection depth
  vx: number;
  vy: number;
  vz: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  color: string;
  radius: number;
  pulseSpeed: number;
  pulseTimer: number;
  labelVisible: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  life: number;
}

interface AssemblyCanvasProps {
  scrollProgress: number; // 0 to 1
  wizardStep?: number;     // 1 to 5 (optional overlay mode for Wizard)
  accentColor?: string;    // Custom color for theme editor link
}

export const AssemblyCanvas: React.FC<AssemblyCanvasProps> = ({
  scrollProgress,
  wizardStep,
  accentColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, isDown: false, active: false });

  // 1. Initialize Nodes
  useEffect(() => {
    const categories: Node["category"][] = ["THEME", "PRODUCT", "RULE", "LAYOUT", "PAYMENT", "CUSTOMER"];
    const names = {
      THEME: ["PrimaryColor", "AccentColor", "SpaceGrotesk", "DarkTheme", "BorderRadius", "BrandStyle"],
      PRODUCT: ["QuantumWatch", "NeonBuds", "LinenShirt", "TrenchCoat", "Honeycrisp", "CatalogSku"],
      RULE: ["FreeShipping", "Buy2Get1", "Welcome10", "CouponStacking", "B2BPricing", "AgeGate"],
      LAYOUT: ["Navbar", "HeroBanner", "GridItem", "CartDrawer", "Footer", "SidebarWidget"],
      PAYMENT: ["StripeCapture", "RazorpayRefund", "SecureToken", "PCIScope", "CurrencyUSD", "IdempotencyKey"],
      CUSTOMER: ["JaneDoe", "SessionCart", "WishlistStore", "OrderHistory", "ReturnSaga", "SegmentGold"],
    };

    const colors = {
      THEME: "#5B5FEF",    // Signal Indigo
      PRODUCT: "#FFB648",  // Signal Amber
      RULE: "#FF6B6B",     // Signal Coral
      LAYOUT: "#34D6A6",   // Signal Mint
      PAYMENT: "#A78BFA",  // Purple
      CUSTOMER: "#38BDF8", // Sky Blue
    };

    const tempNodes: Node[] = [];
    let idCounter = 0;

    categories.forEach((cat) => {
      const catNames = names[cat];
      catNames.forEach((name) => {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const dist = 150 + Math.random() * 200;

        // Initialize at random 3D-sphere shell coordinates
        const x = dist * Math.sin(phi) * Math.cos(theta);
        const y = dist * Math.sin(phi) * Math.sin(theta);
        const z = dist * Math.cos(phi);

        tempNodes.push({
          id: `node-${idCounter++}`,
          name,
          category: cat,
          x,
          y,
          z,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          vz: (Math.random() - 0.5) * 2,
          targetX: x,
          targetY: y,
          targetZ: z,
          color: colors[cat],
          radius: 3.5 + Math.random() * 2.5,
          pulseSpeed: 0.02 + Math.random() * 0.03,
          pulseTimer: Math.random() * Math.PI,
          labelVisible: Math.random() > 0.4,
        });
      });
    });

    nodesRef.current = tempNodes;
  }, []);

  // 2. Set targets dynamically based on scrollProgress / active Act or wizardStep
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    const nodes = nodesRef.current;
    if (nodes.length === 0) return;

    // A. Overlay Mode for Store Wizard Step
    if (wizardStep !== undefined) {
      nodes.forEach((node, idx) => {
        // Form a circular growing gear or steps
        const stepThreshold = wizardStep * 7;
        const active = idx < stepThreshold;

        if (active) {
          // Snap into a beautiful vertical checklist or floating bento box
          const row = idx % 5;
          const col = Math.floor(idx / 5);
          node.targetX = -120 + col * 90 + Math.sin(idx) * 5;
          node.targetY = -150 + row * 70 + Math.cos(idx) * 5;
          node.targetZ = 50;
        } else {
          // Drifting far away back in the shadow
          node.targetX = Math.sin(idx) * 400;
          node.targetY = Math.cos(idx) * 400;
          node.targetZ = -300;
        }
      });
      return;
    }

    // B. Scrolling Act-by-Act Positions on Main Landing Page
    const progress = scrollProgress;

    nodes.forEach((node, idx) => {
      // Setup dynamic variables
      let tx = 0;
      let ty = 0;
      let tz = 0;

      if (progress < 0.12) {
        // --- ACT 1: VOID ---
        // Nodes drift randomly in spherical structure
        const theta = (idx / nodes.length) * Math.PI * 2;
        tx = Math.sin(theta) * 250;
        ty = Math.cos(theta) * 220;
        tz = Math.sin(idx * 3) * 100 - 150;
      } else if (progress < 0.32) {
        // --- ACT 2: ASSEMBLE STOREFRONT ---
        // Nodes fly into layout wireframe (Navbar, Banner, Product Grid, Sidebar)
        const frameProgress = (progress - 0.12) / 0.20; // 0 to 1

        if (node.category === "LAYOUT") {
          // Navbar row
          if (node.name === "Navbar") {
            tx = -250 + (idx % 3) * 250;
            ty = -220;
          } else if (node.name === "Footer") {
            tx = -250 + (idx % 3) * 250;
            ty = 220;
          } else if (node.name === "HeroBanner") {
            tx = 0;
            ty = -100;
          } else {
            // Cards grid
            tx = -150 + (idx % 4) * 100;
            ty = 80;
          }
          tz = 100;
        } else if (node.category === "PRODUCT") {
          // Embedded inside catalog grid card bounds
          tx = -150 + (idx % 4) * 100 + Math.sin(idx) * 10;
          ty = 80 + Math.cos(idx) * 20;
          tz = 120;
        } else if (node.category === "THEME") {
          // Tint widgets / accent buttons
          tx = -280;
          ty = -80 + (idx % 4) * 60;
          tz = 50;
        } else {
          // Background telemetry grid
          const col = idx % 6;
          const row = Math.floor(idx / 6);
          tx = -350 + col * 140;
          ty = -180 + row * 90;
          tz = -200;
        }

        // Interpolate between Act 1 & 2 targets
        const startTheta = (idx / nodes.length) * Math.PI * 2;
        const sX = Math.sin(startTheta) * 250;
        const sY = Math.cos(startTheta) * 220;
        const sZ = Math.sin(idx * 3) * 100 - 150;

        tx = sX + (tx - sX) * frameProgress;
        ty = sY + (ty - sY) * frameProgress;
        tz = sZ + (tz - sZ) * frameProgress;
      } else if (progress < 0.55) {
        // --- ACT 3: RESOLVE TO REAL UI ---
        // Spin slowly around the center in a floating 3D plane
        const spinProgress = (progress - 0.32) / 0.23;
        const theta = (idx / nodes.length) * Math.PI * 2 + spinProgress * Math.PI;

        tx = Math.sin(theta) * 280;
        ty = Math.cos(theta * 1.5) * 150;
        tz = Math.cos(theta) * 150 + 50;
      } else if (progress < 0.72) {
        // --- ACT 4: TEMPLATE GALLERY ---
        // Nodes snap into specific template tracks (Columns and Rows)
        const tProgress = (progress - 0.55) / 0.17;
        const isColumn = idx % 2 === 0;

        if (isColumn) {
          tx = -180 + (idx % 4) * 120;
          ty = -120 + Math.floor(idx / 6) * 120;
        } else {
          tx = -250 + (idx % 3) * 250;
          ty = -50 + Math.floor(idx / 5) * 80;
        }
        tz = Math.sin(idx) * 50 + 20;

        // Blending from Act 3
        const prevTheta = (idx / nodes.length) * Math.PI * 2 + 1.0 * Math.PI;
        const pX = Math.sin(prevTheta) * 280;
        const pY = Math.cos(prevTheta * 1.5) * 150;
        const pZ = Math.cos(prevTheta) * 150 + 50;

        tx = pX + (tx - pX) * tProgress;
        ty = pY + (ty - pY) * tProgress;
        tz = pZ + (tz - pZ) * tProgress;
      } else if (progress < 0.88) {
        // --- ACT 5: SMART CART DEPOSITS ---
        // Vortex funnel pulling into center-right (the shopping cart)
        const cartProgress = (progress - 0.72) / 0.16;
        const angle = (idx * 0.2) + (cartProgress * 8);
        const radius = Math.max(10, 320 - (idx * 6) - (cartProgress * 150));

        // Pull towards cart coordinate (200, 50)
        tx = 150 + Math.cos(angle) * radius;
        ty = 20 + Math.sin(angle) * radius;
        tz = Math.cos(angle) * 80;
      } else {
        // --- ACT 6: LOGOTYPE ASSEMBLY (PAYOFF) ---
        // Align nodes to spell out "CORE" / geometric letters
        const finalProgress = (progress - 0.88) / 0.12;
        const letterIdx = idx % 4; // C, O, R, E
        const offset = (idx % 8) * 15;

        if (letterIdx === 0) {
          // "C" shape
          tx = -250;
          ty = -80 + (idx % 6) * 30;
          if (idx % 6 === 0 || idx % 6 === 5) tx += 30;
        } else if (letterIdx === 1) {
          // "O" shape
          const t = (idx % 6) * (Math.PI / 3);
          tx = -110 + Math.cos(t) * 40;
          ty = -5 + Math.sin(t) * 50;
        } else if (letterIdx === 2) {
          // "R" shape
          tx = 30;
          ty = -80 + (idx % 6) * 30;
          if (idx % 6 < 3) tx += 35;
        } else {
          // "E" shape
          tx = 160;
          ty = -80 + (idx % 6) * 30;
          if (idx % 2 === 0) tx += 40;
        }
        tz = 80;

        // Blend from Act 5
        const prevAngle = (idx * 0.2) + (1 * 8);
        const prevRadius = Math.max(10, 320 - (idx * 6) - (1 * 150));
        const pX = 150 + Math.cos(prevAngle) * prevRadius;
        const pY = 20 + Math.sin(prevAngle) * prevRadius;
        const pZ = Math.cos(prevAngle) * 80;

        tx = pX + (tx - pX) * finalProgress;
        ty = pY + (ty - pY) * finalProgress;
        tz = pZ + (tz - pZ) * finalProgress;
      }

      node.targetX = tx;
      node.targetY = ty;
      node.targetZ = tz;
    });
  }, [scrollProgress, wizardStep]);

  // 3. Canvas Render & Simulation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const resizeHandler = () => {
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };

    window.addEventListener("resize", resizeHandler);

    // Track mouse coordinates
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.targetX = e.clientX - rect.left - width / 2;
      mouseRef.current.targetY = e.clientY - rect.top - height / 2;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      mouseRef.current.isDown = true;
      // Spawn burst particles on click
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left - width / 2;
      const clickY = e.clientY - rect.top - height / 2;

      for (let i = 0; i < 20; i++) {
        const speed = 1 + Math.random() * 5;
        const angle = Math.random() * Math.PI * 2;
        particlesRef.current.push({
          x: clickX,
          y: clickY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: accentColor || "#34D6A6",
          alpha: 1,
          size: 1.5 + Math.random() * 2,
          life: 40 + Math.random() * 40,
        });
      }
    };

    const handleMouseUp = () => {
      mouseRef.current.isDown = false;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mouseup", handleMouseUp);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw absolute background grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
      ctx.lineWidth = 1;
      const gridSize = 80;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Smooth mouse follow
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.1;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.1;

      const nodes = nodesRef.current;
      const particles = particlesRef.current;

      // Render burst particles
      particlesRef.current = particles.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 1 / p.life;
        p.life--;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x + width / 2, p.y + height / 2, p.size, 0, Math.PI * 2);
        ctx.fill();

        return p.life > 0;
      });
      ctx.globalAlpha = 1;

      // Update node positions with 3D projection
      nodes.forEach((node) => {
        // Standard mass-damper spring logic for smooth alignment transition
        node.x += (node.targetX - node.x) * 0.07;
        node.y += (node.targetY - node.y) * 0.07;
        node.z += (node.targetZ - node.z) * 0.07;

        // Apply custom magnetic cursor pull if near
        if (mouseRef.current.active) {
          const dx = mouseRef.current.x - node.x;
          const dy = mouseRef.current.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const force = (120 - dist) / 120;
            node.x += dx * force * 0.08;
            node.y += dy * force * 0.08;
          }
        }

        // Advance pulse timer
        node.pulseTimer += node.pulseSpeed;
      });

      // Draw connection wires (Plexus network) based on 3D distance
      ctx.lineWidth = 0.8;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];

          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const dz = n2.z - n1.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          // Connect if category matches or they are within proximity
          const categoryMatch = n1.category === n2.category && dist < 110;
          const proximityMatch = dist < 75;

          if (categoryMatch || proximityMatch) {
            const alpha = categoryMatch
              ? (110 - dist) / 110 * 0.18
              : (75 - dist) / 75 * 0.09;

            // Project 3D coordinate mapping down to 2D screen viewport
            const perspective1 = 400 / (400 - n1.z);
            const x1 = n1.x * perspective1 + width / 2;
            const y1 = n1.y * perspective1 + height / 2;

            const perspective2 = 400 / (400 - n2.z);
            const x2 = n2.x * perspective2 + width / 2;
            const y2 = n2.y * perspective2 + height / 2;

            // Simple offscreen guard
            if (x1 > 0 && x1 < width && y1 > 0 && y1 < height && x2 > 0 && x2 < width && y2 > 0 && y2 < height) {
              const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
              gradient.addColorStop(0, n1.color);
              gradient.addColorStop(1, n2.color);

              ctx.strokeStyle = gradient;
              ctx.globalAlpha = alpha;
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
            }
          }
        }
      }
      ctx.globalAlpha = 1;

      // Render the main Node dots and billboarding text tags
      nodes.forEach((node) => {
        const perspective = 400 / (400 - node.z);
        const scrX = node.x * perspective + width / 2;
        const scrY = node.y * perspective + height / 2;

        if (scrX < 0 || scrX > width || scrY < 0 || scrY > height) return;

        // Base pulsing scale
        const sizeMultiplier = 1 + Math.sin(node.pulseTimer) * 0.15;
        const size = node.radius * perspective * sizeMultiplier;

        // Node Glow Ring
        ctx.shadowBlur = size * 1.8;
        ctx.shadowColor = node.color;

        // Central Circle
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(scrX, scrY, size, 0, Math.PI * 2);
        ctx.fill();

        // Reset shadow
        ctx.shadowBlur = 0;

        // Draw billboarding mono labels
        if (node.labelVisible) {
          ctx.font = `500 ${Math.max(8, Math.round(9 * perspective))}px "JetBrains Mono", monospace`;
          ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
          ctx.fillText(node.name, scrX + size + 6, scrY + 3);

          // Draw small bullet line linking label to node center
          ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
          ctx.beginPath();
          ctx.moveTo(scrX + size + 1, scrY);
          ctx.lineTo(scrX + size + 4, scrY);
          ctx.stroke();
        }
      });

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resizeHandler);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mouseup", handleMouseUp);
      cancelAnimationFrame(animId);
    };
  }, [accentColor]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-auto select-none"
      style={{ zIndex: 0 }}
    />
  );
};
