// A tiny particle engine for move impacts. Canvas, hand-rolled, zero
// dependencies - the same rule as the QR encoder and the router.
//
// The look we are after is a mark being *slammed* onto the board: a hard
// flash, sparks thrown outward with trails, a shockwave ring, and a little
// glyph debris so it reads as this game rather than a generic firework.
// Everything is drawn additively so overlapping sparks bloom the way
// phosphor does instead of muddying to grey.
//
// The loop runs only while something is alive: a finished burst releases
// the frame callback entirely, so an idle board costs nothing.

export interface BurstOptions {
  x: number;
  y: number;
  color: string;
  // Cell size drives the scale of everything, so a 3x3 board and a 12x12
  // board feel equally weighted rather than the big one looking sparse.
  scale: number;
}

interface Spark {
  x: number;
  y: number;
  // Velocity in pixels per second - every step multiplies by the frame
  // delta, so the burst looks identical at 60Hz and 120Hz.
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  // Glyph sparks draw a character instead of a streak.
  glyph?: string;
}

interface Ring {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  scale: number;
}

const GLYPHS = "01<>/\\|=+*#".split("");

// Both are expressed relative to the cell size, so a 3x3 board and a 12x12
// board throw sparks that look the same rather than the big board looking
// limp. Gravity is px/s^2, drag is the fraction of speed kept per second.
const GRAVITY_PER_SCALE = 7;
const DRAG_PER_SECOND = 0.12;
// How far back a streak reaches, in seconds of travel.
const TRAIL_SECONDS = 0.028;

const random = (min: number, max: number) => min + Math.random() * (max - min);

export class ParticleField {
  #canvas: HTMLCanvasElement;
  #context: CanvasRenderingContext2D | null;
  #sparks: Spark[] = [];
  #rings: Ring[] = [];
  #frame: number | null = null;
  #last = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    this.#context = canvas.getContext("2d");
    // A hidden tab stops firing animation frames, which freezes a burst
    // mid-flight and leaves it painted there until the tab comes back.
    // Dropping everything on the way out means you return to a clean
    // board rather than to yesterday's sparks.
    document.addEventListener("visibilitychange", this.#onVisibility);
  }

  #onVisibility = () => {
    if (document.hidden) {
      this.clear();
    }
  };

  clear() {
    if (this.#frame !== null) {
      cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
    this.#sparks = [];
    this.#rings = [];
    const ratio = window.devicePixelRatio || 1;
    this.#context?.clearRect(
      0,
      0,
      this.#canvas.width / ratio,
      this.#canvas.height / ratio
    );
  }

  // Match the backing store to the element's real pixel size, so sparks
  // are crisp on a retina display instead of soft.
  resize(width: number, height: number, ratio = window.devicePixelRatio || 1) {
    this.#canvas.width = Math.max(1, Math.floor(width * ratio));
    this.#canvas.height = Math.max(1, Math.floor(height * ratio));
    this.#canvas.style.width = `${width}px`;
    this.#canvas.style.height = `${height}px`;
    this.#context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  burst({ x, y, color, scale }: BurstOptions) {
    const count = Math.round(random(34, 44));
    for (let i = 0; i < count; i++) {
      // Evenly spread *then* heavily jittered. A perfectly radial burst
      // reads as a clock face; the jitter and the wide speed range are
      // what make it read as debris thrown off an impact.
      const angle =
        (i / count) * Math.PI * 2 + random(-0.55, 0.55);
      // A few sparks fly much further than the rest - the outliers are
      // what sell the violence.
      const fast = Math.random() < 0.22;
      const speed = (fast ? random(4.2, 6.5) : random(1.2, 3.4)) * scale;
      const isGlyph = i % 9 === 0;
      const maxLife = fast ? random(0.3, 0.5) : random(0.32, 0.62);
      this.#sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        // A slight upward bias so the burst arcs before it falls.
        vy: Math.sin(angle) * speed - random(0.2, 0.9) * scale,
        gravity: GRAVITY_PER_SCALE * scale,
        life: maxLife,
        maxLife,
        size: isGlyph ? scale * 0.1 : random(0.006, 0.018) * scale,
        color,
        glyph: isGlyph
          ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
          : undefined,
      });
    }
    // One quick shock front. It should be gone before the eye settles on
    // it - any longer and the ring, not the impact, becomes the subject.
    this.#rings.push({
      x,
      y,
      radius: scale * 0.08,
      life: 0.26,
      maxLife: 0.26,
      color,
      scale,
    });
    this.#start();
  }

  #start() {
    if (this.#frame !== null) {
      return;
    }
    this.#last = performance.now();
    this.#frame = requestAnimationFrame(this.#tick);
  }

  #tick = (now: number) => {
    // Clamp the step so a backgrounded tab does not teleport everything
    // off screen when it resumes.
    const delta = Math.min((now - this.#last) / 1000, 0.05);
    this.#last = now;
    this.#advance(delta);
    this.#draw();
    if (this.#sparks.length === 0 && this.#rings.length === 0) {
      // Nothing alive: release the frame callback entirely so an idle
      // board costs nothing at all.
      this.#frame = null;
      return;
    }
    this.#frame = requestAnimationFrame(this.#tick);
  };

  #advance(delta: number) {
    // Frame-rate independent drag: keeping 12% of speed per second is the
    // same curve whether we get 60 or 120 frames to do it in.
    const drag = Math.pow(DRAG_PER_SECOND, delta);
    this.#sparks = this.#sparks.filter((spark) => {
      spark.life -= delta;
      if (spark.life <= 0) {
        return false;
      }
      spark.vy += spark.gravity * delta;
      spark.vx *= drag;
      spark.vy *= drag;
      spark.x += spark.vx * delta;
      spark.y += spark.vy * delta;
      return true;
    });
    this.#rings = this.#rings.filter((ring) => {
      ring.life -= delta;
      if (ring.life <= 0) {
        return false;
      }
      // Decelerating expansion - fast out of the impact, easing wide.
      const progress = 1 - ring.life / ring.maxLife;
      ring.radius = ring.scale * (0.08 + Math.sqrt(progress) * 0.62);
      return true;
    });
  }

  #draw() {
    const context = this.#context;
    if (!context) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    context.clearRect(
      0,
      0,
      this.#canvas.width / ratio,
      this.#canvas.height / ratio
    );
    // Additive blending: overlapping sparks bloom rather than muddy.
    context.globalCompositeOperation = "lighter";

    this.#rings.forEach((ring) => {
      // Fades on a curve rather than linearly, so it punches out and
      // vanishes instead of lingering as a drawn circle.
      const fade = (ring.life / ring.maxLife) ** 2;
      context.globalAlpha = fade * 0.45;
      context.strokeStyle = ring.color;
      context.lineWidth = Math.max(1, ring.scale * 0.02 * fade);
      context.beginPath();
      context.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      context.stroke();
    });

    this.#sparks.forEach((spark) => {
      const fade = spark.life / spark.maxLife;
      context.globalAlpha = Math.min(1, fade * 1.4);
      if (spark.glyph) {
        context.fillStyle = spark.color;
        context.font = `${Math.max(6, spark.size)}px ui-monospace, monospace`;
        context.fillText(spark.glyph, spark.x, spark.y);
        return;
      }
      // A streak from where it was to where it is - motion you can read.
      context.strokeStyle = spark.color;
      context.lineWidth = Math.max(1, spark.size * fade);
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(
        spark.x - spark.vx * TRAIL_SECONDS,
        spark.y - spark.vy * TRAIL_SECONDS
      );
      context.lineTo(spark.x, spark.y);
      context.stroke();
    });

    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  }

  destroy() {
    document.removeEventListener("visibilitychange", this.#onVisibility);
    this.clear();
  }
}
