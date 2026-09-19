import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface KanbanCardEntry {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  position: number;
}

interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any> & { cards?: KanbanCardEntry[]; friendly_name?: string };
}

interface HomeAssistant {
  states: Record<string, HassEntity>;
  callService: (domain: string, service: string, data: Record<string, unknown>) => Promise<void>;
}

interface KanbanCardConfig {
  type: string;
  title?: string;
  entities: string[];
}

/**
 * Mirrors a kanban board inside Home Assistant. Each `entities` item must be a
 * `sensor.kanban_*` entity created by the Kanban Board integration (one per
 * column). Tap a card to move it — there is no drag-and-drop in this version,
 * see /homeassistant/README.md for why.
 */
@customElement('kanban-card')
export class KanbanCard extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @state() private config!: KanbanCardConfig;
  @state() private movingCardId: string | null = null;

  setConfig(config: KanbanCardConfig): void {
    if (!config.entities || config.entities.length === 0) {
      throw new Error('kanban-card: "entities" must list at least one sensor.kanban_* entity');
    }
    this.config = config;
  }

  getCardSize(): number {
    return 1 + Math.max(...this.columns().map((c) => c.cards.length), 0);
  }

  private columns() {
    return this.config.entities
      .map((entityId) => this.hass.states[entityId])
      .filter((entity): entity is HassEntity => !!entity)
      .map((entity) => ({
        entityId: entity.entity_id,
        name: entity.attributes.friendly_name ?? entity.entity_id,
        cards: [...(entity.attributes.cards ?? [])].sort((a, b) => a.position - b.position),
      }));
  }

  private async moveCard(cardId: string, columnId: string): Promise<void> {
    this.movingCardId = null;
    await this.hass.callService('kanban', 'move_card', {
      card_id: cardId,
      column_id: columnId,
      position: 0,
    });
  }

  private columnIdFromEntity(entityId: string): string {
    // unique_id / attribute shape is `kanban_<board_id>_<column_id>`; the
    // integration also exposes the raw column id as an attribute.
    return this.hass.states[entityId]?.attributes['column_id'] ?? entityId;
  }

  protected render() {
    if (!this.config || !this.hass) return nothing;
    const columns = this.columns();

    return html`
      <ha-card .header=${this.config.title ?? 'Kanban'}>
        <div class="board">
          ${columns.map(
            (column) => html`
              <div class="column">
                <div class="column-title">${column.name}</div>
                ${column.cards.map(
                  (card) => html`
                    <div class="card" @click=${() => (this.movingCardId = card.id)}>
                      <div class="card-title">${card.title}</div>
                      ${card.due_date ? html`<div class="card-due">${card.due_date}</div>` : nothing}
                      ${this.movingCardId === card.id
                        ? html`
                            <div class="move-menu" @click=${(e: Event) => e.stopPropagation()}>
                              ${columns
                                .filter((c) => c.entityId !== column.entityId)
                                .map(
                                  (target) => html`
                                    <button
                                      @click=${() =>
                                        this.moveCard(card.id, this.columnIdFromEntity(target.entityId))}
                                    >
                                      Move to ${target.name}
                                    </button>
                                  `,
                                )}
                              <button class="cancel" @click=${() => (this.movingCardId = null)}>
                                Cancel
                              </button>
                            </div>
                          `
                        : nothing}
                    </div>
                  `,
                )}
              </div>
            `,
          )}
        </div>
      </ha-card>
    `;
  }

  static styles = css`
    .board {
      display: flex;
      gap: 12px;
      padding: 12px 16px 16px;
      overflow-x: auto;
    }
    .column {
      flex: 0 0 180px;
      background: var(--secondary-background-color, #f4f4f4);
      border-radius: 8px;
      padding: 8px;
    }
    .column-title {
      font-weight: 600;
      font-size: 0.85em;
      margin-bottom: 8px;
      color: var(--primary-text-color);
    }
    .card {
      position: relative;
      background: var(--card-background-color, #fff);
      border-radius: 6px;
      padding: 8px;
      margin-bottom: 6px;
      box-shadow: var(--ha-card-box-shadow, 0 1px 2px rgba(0, 0, 0, 0.1));
      cursor: pointer;
      font-size: 0.85em;
      color: var(--primary-text-color);
    }
    .card-due {
      font-size: 0.8em;
      color: var(--secondary-text-color);
      margin-top: 4px;
    }
    .move-menu {
      position: absolute;
      z-index: 5;
      top: 100%;
      left: 0;
      background: var(--card-background-color, #fff);
      border: 1px solid var(--divider-color, #ddd);
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      min-width: 140px;
    }
    .move-menu button {
      background: none;
      border: none;
      text-align: left;
      padding: 8px 10px;
      cursor: pointer;
      font-size: 0.85em;
      color: var(--primary-text-color);
    }
    .move-menu button:hover {
      background: var(--secondary-background-color, #f4f4f4);
    }
    .move-menu button.cancel {
      color: var(--secondary-text-color);
      border-top: 1px solid var(--divider-color, #ddd);
    }
  `;
}

declare global {
  interface Window {
    customCards?: Array<Record<string, unknown>>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'kanban-card',
  name: 'Kanban Card',
  description: 'Mirrors a kanban board, tap a card to move it between columns.',
});
