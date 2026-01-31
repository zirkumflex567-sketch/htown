import Phaser from "phaser";
import type { Room } from "colyseus.js";
import type { RoomState, SeatType } from "@htown/shared";

const seatLabels: Record<SeatType, string> = {
  pilot: "Pilot",
  gunner: "Gunner",
  power: "Power",
  systems: "Systems",
  support: "Support",
};

export class GameScene extends Phaser.Scene {
  private room: Room<RoomState> | null = null;
  private shipGraphic!: Phaser.GameObjects.Triangle;
  private enemyGraphics = new Map<string, Phaser.GameObjects.Arc>();
  private darkness!: Phaser.GameObjects.Graphics;
  private light!: Phaser.GameObjects.Graphics;
  private panelGraphics!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private seatText!: Phaser.GameObjects.Text;
  private upgradeText!: Phaser.GameObjects.Text;
  private localSeat: SeatType = "pilot";
  private lastPointer = { x: 1, y: 0 };
  private firePressed = false;
  private boostPressed = false;
  private powerSliders = { engines: 0.34, weapons: 0.33, shields: 0.33 };
  private currentWeapon = "mg";

  constructor() {
    super("game");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x04070d);

    this.shipGraphic = this.add.triangle(0, 0, -10, 12, 14, 0, -10, -12, 0x67d5ff);
    this.shipGraphic.setStrokeStyle(2, 0x1b3d5a);
    this.darkness = this.add.graphics();
    this.darkness.setScrollFactor(0);
    this.light = this.add.graphics();
    this.light.setScrollFactor(0);
    this.light.setBlendMode(Phaser.BlendModes.ADD);
    this.panelGraphics = this.add.graphics();
    this.panelGraphics.setScrollFactor(0);

    this.hudText = this.add.text(16, 12, "", {
      color: "#cfe4ff",
      fontSize: "14px",
    });
    this.hudText.setScrollFactor(0);

    this.seatText = this.add.text(16, 32, "", {
      color: "#f9d65c",
      fontSize: "14px",
    });
    this.seatText.setScrollFactor(0);

    this.upgradeText = this.add.text(16, 52, "", {
      color: "#9ee07a",
      fontSize: "12px",
    });
    this.upgradeText.setScrollFactor(0);

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.lastPointer = { x: worldPoint.x, y: worldPoint.y };
    });
    this.input.on("pointerdown", () => {
      this.firePressed = true;
    });
    this.input.on("pointerup", () => {
      this.firePressed = false;
    });

    this.input.keyboard?.on("keydown-SPACE", () => {
      this.boostPressed = true;
    });
    this.input.keyboard?.on("keyup-SPACE", () => {
      this.boostPressed = false;
    });

    this.input.keyboard?.on("keydown-ONE", () => this.setPowerPreset(0.5, 0.25, 0.25));
    this.input.keyboard?.on("keydown-TWO", () => this.setPowerPreset(0.33, 0.33, 0.34));
    this.input.keyboard?.on("keydown-THREE", () => this.setPowerPreset(0.25, 0.5, 0.25));

    this.input.keyboard?.on("keydown-Q", () => this.triggerAbility(0));
    this.input.keyboard?.on("keydown-W", () => this.triggerAbility(1));
    this.input.keyboard?.on("keydown-E", () => this.triggerAbility(2));

    this.input.keyboard?.on("keydown-R", () => this.triggerSupport("repair"));
    this.input.keyboard?.on("keydown-T", () => this.triggerSupport("scan"));
    this.input.keyboard?.on("keydown-Y", () => this.triggerSupport("loot"));

    this.input.keyboard?.on("keydown-Z", () => this.setWeapon("mg"));
    this.input.keyboard?.on("keydown-X", () => this.setWeapon("shotgun"));
    this.input.keyboard?.on("keydown-C", () => this.setWeapon("rocket"));
  }

  attachRoom(room: Room<RoomState>): void {
    this.room = room;
    room.onStateChange((state) => {
      const player = state.players.get(room.sessionId);
      if (player) {
        this.localSeat = player.seat as SeatType;
      }
      this.renderState(state);
    });
  }

  private renderState(state: RoomState): void {
    this.shipGraphic.setPosition(state.ship.x, state.ship.y);
    this.shipGraphic.setRotation(state.ship.rotation);

    this.renderPanels();

    const lightX = this.scale.width / 2 + state.ship.x * 0.5;
    const lightY = this.scale.height / 2 + state.ship.y * 0.5;
    this.darkness.clear();
    this.darkness.fillStyle(0x04070d, 0.9);
    this.darkness.fillRect(0, 0, this.scale.width, this.scale.height);
    this.light.clear();
    this.light.fillStyle(0x355e80, 0.35);
    this.light.fillCircle(lightX, lightY, 160);

    const existing = new Set(this.enemyGraphics.keys());
    state.enemies.forEach((enemy) => {
      existing.delete(enemy.id);
      if (!this.enemyGraphics.has(enemy.id)) {
        const color = enemy.kind === "runner" ? 0xff7a75 : enemy.kind === "spitter" ? 0x9ef5ff : 0xffc46a;
        const dot = this.add.circle(enemy.x, enemy.y, 6, color);
        dot.setStrokeStyle(2, 0x1b1b1b);
        this.enemyGraphics.set(enemy.id, dot);
      }
      const dot = this.enemyGraphics.get(enemy.id);
      if (dot) {
        dot.setPosition(enemy.x, enemy.y);
        dot.setAlpha(enemy.revealed ? 1 : 0.25);
      }
    });

    existing.forEach((id) => {
      this.enemyGraphics.get(id)?.destroy();
      this.enemyGraphics.delete(id);
    });

    this.hudText.setText(
      `Wave ${state.wave} | Score ${state.score} | HP ${Math.round(state.ship.hp)} | Shields ${Math.round(
        state.ship.shield
      )}`
    );
    this.seatText.setText(`You are: ${seatLabels[this.localSeat]}`);
    if (state.swapCountdown > 0) {
      this.upgradeText.setText(`Swap in ${state.swapCountdown.toFixed(1)}s`);
    } else if (state.upgrades.length > 0) {
      const text = state.upgrades.map((up, idx) => `${idx + 1}. [${up.seat}] ${up.label}`).join("\n");
      this.upgradeText.setText(`Upgrades:\n${text}`);
    } else {
      this.upgradeText.setText(state.announcer ? state.announcer : "");
    }
  }

  private renderPanels(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const panelColor = (seat: SeatType) => (seat === this.localSeat ? 0x3a6ea5 : 0x1a2a3f);

    this.panelGraphics.clear();
    this.panelGraphics.fillStyle(panelColor(\"pilot\"), 0.35);
    this.panelGraphics.fillRoundedRect(8, height * 0.25, 160, height * 0.4, 8);

    this.panelGraphics.fillStyle(panelColor(\"gunner\"), 0.35);
    this.panelGraphics.fillRoundedRect(width - 168, height * 0.25, 160, height * 0.4, 8);

    this.panelGraphics.fillStyle(panelColor(\"power\"), 0.35);
    this.panelGraphics.fillRoundedRect(width * 0.25, height - 120, width * 0.5, 100, 8);

    this.panelGraphics.fillStyle(panelColor(\"support\"), 0.35);
    this.panelGraphics.fillRoundedRect(8, height - 120, 160, 100, 8);

    this.panelGraphics.fillStyle(panelColor(\"systems\"), 0.35);
    this.panelGraphics.fillRoundedRect(width - 168, height - 120, 160, 100, 8);
  }

  update(): void {
    if (!this.room) return;
    const state = this.room.state;
    if (!state) return;

    if (this.localSeat === "pilot") {
      const pointer = this.input.activePointer;
      const dx = pointer.isDown ? pointer.x - this.scale.width / 2 : 0;
      const dy = pointer.isDown ? pointer.y - this.scale.height / 2 : 0;
      const len = Math.hypot(dx, dy) || 1;
      const moveX = dx / len;
      const moveY = dy / len;
      this.room.send("input", { x: moveX, y: moveY, boost: this.boostPressed });
    }

    if (this.localSeat === "gunner") {
      const dx = this.lastPointer.x - state.ship.x;
      const dy = this.lastPointer.y - state.ship.y;
      const len = Math.hypot(dx, dy) || 1;
      this.room.send("input", {\n        aimX: dx / len,\n        aimY: dy / len,\n        fire: this.firePressed,\n        weapon: this.currentWeapon,\n      });
    }

    if (this.localSeat === "power") {
      this.room.send("input", this.powerSliders);
    }
  }

  handleUpgradeChoice(index: number): void {
    if (!this.room) return;
    const upgrade = this.room.state.upgrades[index];
    if (!upgrade) return;
    this.room.send("upgrade", { id: upgrade.id });
  }

  private setPowerPreset(engines: number, weapons: number, shields: number): void {
    if (this.localSeat !== "power") return;
    this.powerSliders = { engines, weapons, shields };
  }

  private setWeapon(weapon: string): void {
    if (this.localSeat !== "gunner") return;
    this.currentWeapon = weapon;
  }

  private triggerAbility(index: number): void {
    if (this.localSeat !== "systems") return;
    this.room?.send("input", { ability: index });
    setTimeout(() => this.room?.send("input", { ability: -1 }), 100);
  }

  private triggerSupport(action: "repair" | "scan" | "loot"): void {
    if (this.localSeat !== "support") return;
    this.room?.send("input", { [action]: true });
    setTimeout(() => this.room?.send("input", { [action]: false }), 100);
  }
}

export function createGame(room: Room<RoomState>): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: "game-root",
    width: window.innerWidth,
    height: Math.max(600, window.innerHeight - 200),
    backgroundColor: "#05090f",
    scene: GameScene,
    physics: { default: "arcade" },
  };
  const game = new Phaser.Game(config);
  const scene = game.scene.keys.game as GameScene;
  scene.attachRoom(room);

  window.addEventListener("resize", () => {
    game.scale.resize(window.innerWidth, Math.max(600, window.innerHeight - 200));
  });
  return game;
}
