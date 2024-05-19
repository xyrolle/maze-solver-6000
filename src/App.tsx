import { createSignal, createEffect, createMemo, For } from "solid-js";
import { mkSimplexNoise } from "@spissvinkel/simplex-noise";
import "./styles.css";
import { createTimer } from "@solid-primitives/timer";

// Constants and Enums
const INITIAL_ROWS = 16;
const INITIAL_COLS = 16;

enum STRATEGIES {
  BFS = "BFS",
  DFS = "DFS",
  AStar = "A*",
}

enum AddingMode {
  START = "START",
  GOAL = "GOAL",
  WALL = "WALL",
}

interface SearchStrategy {
  initialize(start: TPosition, goal: TPosition): void;
  getNextNode(queue: Array<TPosition>, goal: TPosition): TPosition | null;
  processNeighbour(
    currentPos: TPosition,
    neighbour: TPosition,
    parentMap: Map<number, TPosition>,
  ): boolean;
}

const bfsStrategy: SearchStrategy = {
  initialize() {},
  getNextNode(queue) {
    return queue.shift() || null;
  },
  processNeighbour() {
    return true;
  },
};

const dfsStrategy: SearchStrategy = {
  initialize() {},
  getNextNode(queue) {
    return queue.pop() || null;
  },
  processNeighbour() {
    return true;
  },
};

const aStarStrategy: SearchStrategy = {
  gScore: new Map<string, number>(),
  parentMap: new Map<string, TPosition>(),

  initialize(start) {
    this.gScore.clear();
    this.parentMap.clear();
    this.gScore.set(generateKey(start[0], start[1]), 0);
  },

  getNextNode(queue, goal) {
    let minF = Infinity;
    let minIndex = -1;

    for (let i = 0; i < queue.length; i++) {
      const [row, column] = queue[i];
      const g = this.gScore.get(generateKey(row, column)) || 0;
      const h = manhattanDistance([row, column], goal);
      const f = g + h;

      if (f < minF) {
        minF = f;
        minIndex = i;
      }
    }

    if (minIndex > -1) {
      return queue.splice(minIndex, 1)[0];
    }
    return null;
  },

  processNeighbour(currentPos, neighbour) {
    const currentKey = generateKey(currentPos[0], currentPos[1]);
    const neighbourKey = generateKey(neighbour[0], neighbour[1]);
    const tentativeGScore = (this.gScore.get(currentKey) || 0) + 1;

    if (
      !this.gScore.has(neighbourKey) ||
      tentativeGScore < this.gScore.get(neighbourKey)!
    ) {
      this.gScore.set(neighbourKey, tentativeGScore);
      this.parentMap.set(neighbourKey, currentPos);
      return true;
    }
    return false;
  },

  getOptimalPath() {
    const path: TPosition[] = [];
    let currentKey = Array.from(this.parentMap.keys()).pop();
    while (currentKey) {
      const currentPos = this.parentMap.get(currentKey);
      if (currentPos) {
        path.push(currentPos);
        currentKey = generateKey(currentPos[0], currentPos[1]);
      } else {
        break;
      }
    }
    return path;
  },
};

const GRID_WIDTH = 1200;

export type TPosition = [number, number];

export type TGrid = Map<string, ICell>;

function generateKey(row: number, column: number): string {
  return `${row}-${column}`;
}

export const initialGrid = (rows: number, columns: number): TGrid => {
  const grid = new Map<string, ICell>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      grid.set(generateKey(r, c), CellFactory.default());
    }
  }
  return grid;
};

export const getNeighbours = (
  [row, column]: [number, number],
  grid: TGrid,
): Array<[number, number]> => {
  const neighbours: Array<[number, number]> = [];
  const possibleNeighbours = [
    [row - 1, column],
    [row + 1, column],
    [row, column - 1],
    [row, column + 1],
  ];
  for (const [r, c] of possibleNeighbours) {
    if (grid.has(generateKey(r, c))) {
      neighbours.push([r, c]);
    }
  }
  return neighbours;
};

export const manhattanDistance = (
  [x1, y1]: [number, number],
  [x2, y2]: [number, number],
) => Math.abs(x1 - x2) + Math.abs(y1 - y2);

export function getClass(...classes: (string | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export interface ICell {
  id: number;
  state: {
    isStart: boolean;
    isActive: boolean;
    isWall: boolean;
    isVisited: boolean;
    isQueued: boolean;
    isGoal: boolean;
    isPath: boolean;
  };
  content?: string;
}

const shouldNotPutWall = (cell: ICell) => {
  if (!cell) return true;

  return cell.state.isWall || cell.state.isGoal || cell.state.isStart;
};

export const getBorderStyles = (
  row: number,
  column: number,
  rows: number,
  columns: number,
  grid: TGrid,
) => {
  const styles: Record<string, string> = {
    "border-top": "1px solid #58585c",
    "border-bottom": "1px solid #58585c",
    "border-left": "1px solid #58585c",
    "border-right": "1px solid #58585c",
  };

  if (
    row === 0 ||
    (row > 0 && shouldNotPutWall(grid.get(generateKey(row - 1, column))!))
  ) {
    styles["border-top"] = "1px solid transparent";
  }
  if (
    row === rows - 1 ||
    (row < rows - 1 &&
      shouldNotPutWall(grid.get(generateKey(row + 1, column))!))
  ) {
    styles["border-bottom"] = "1px solid transparent";
  }
  if (
    column === 0 ||
    (column > 0 && shouldNotPutWall(grid.get(generateKey(row, column - 1))!))
  ) {
    styles["border-left"] = "1px solid transparent";
  }
  if (
    column === columns - 1 ||
    (column < columns - 1 &&
      shouldNotPutWall(grid.get(generateKey(row, column + 1))!))
  ) {
    styles["border-right"] = "1px solid transparent";
  }

  return styles;
};

interface CellProps {
  row: number;
  column: number;
  data: ICell;
  rows: () => number;
  grid: () => TGrid;
  columns: () => number;
}

export function Cell(props: CellProps) {
  const {
    row,
    column,
    rows,
    columns,
    grid,
    data: { state },
  } = props;

  const className = getClass(
    "cell",
    state.isStart && "start",
    state.isActive && "active",
    state.isQueued && "is-queued",
    state.isVisited && "visited",
    state.isWall && "wall",
    state.isGoal && "goal",
    state.isPath && "path",
  );

  const borderStyles = state.isWall
    ? getBorderStyles(row, column, rows(), columns(), grid())
    : {};

  return (
    <div
      data-row={row}
      data-column={column}
      class={className}
      style={{
        width: `${GRID_WIDTH / columns()}px`,
        "font-size": `${256 / columns()}px`,
        ...borderStyles,
      }}
    >
      {state.isGoal
        ? "G"
        : state.isStart
          ? "S"
          : state.isWall || state.isVisited
            ? ""
            : props.data.content}
    </div>
  );
}

export class CellFactory {
  public static default(): ICell {
    return {
      id: this._generateId(),
      state: this.defaultState(),
    };
  }

  public static defaultState() {
    return {
      isStart: false,
      isActive: false,
      isWall: false,
      isVisited: false,
      isQueued: false,
      isGoal: false,
      isPath: false,
    };
  }

  public static start(): ICell {
    return {
      ...this.default(),
      state: { ...this.defaultState(), isStart: true },
    };
  }

  public static goal(): ICell {
    return {
      ...this.default(),
      state: { ...this.defaultState(), isGoal: true },
    };
  }

  public static wall(): ICell {
    return {
      ...this.default(),
      state: { ...this.defaultState(), isWall: true },
    };
  }

  public static visited(): ICell {
    return {
      ...this.default(),
      state: { ...this.defaultState(), isVisited: true },
    };
  }

  public static queued(): ICell {
    return {
      ...this.default(),
      state: { ...this.defaultState(), isQueued: true },
    };
  }

  public static path(): ICell {
    return {
      ...this.default(),
      state: { ...this.defaultState(), isPath: true },
    };
  }

  public static build(mode: AddingMode): ICell {
    switch (mode) {
      case AddingMode.START:
        return this.start();
      case AddingMode.GOAL:
        return this.goal();
      case AddingMode.WALL:
        return this.wall();
      default:
        return this.default();
    }
  }

  private static _generateId(): number {
    return Math.floor(Math.random() * 10000000000);
  }
}

// Control Component
interface ControlProps {
  content: any;
  addingMode: () => AddingMode;
  mode: AddingMode;
  disabled: boolean;
  className: string;
  handleClick: () => void;
}

export function Control(props: ControlProps) {
  const { content, addingMode, mode, disabled, className, handleClick } = props;

  const combinedClassName = createMemo(() => {
    return getClass(
      className,
      addingMode() === mode && !disabled && "selected",
    );
  });

  return (
    <div class={combinedClassName()} onClick={handleClick}>
      {content}
    </div>
  );
}

// Controls Component
interface ControlsProps {
  addingMode: () => AddingMode;
  setAddingMode: (mode: AddingMode) => void;
  canStep: () => boolean;
}

const carr = [
  {
    content: "S",
    className: "start",
    mode: AddingMode.START,
  },
  {
    content: "G",
    className: "goal",
    mode: AddingMode.GOAL,
  },
  {
    content: "W",
    className: "wall",
    mode: AddingMode.WALL,
  },
];

export function Controls(props: ControlsProps) {
  const { addingMode, canStep, setAddingMode } = props;

  const handleModeClick = (mode: AddingMode) => {
    if (canStep()) {
      setAddingMode(mode);
    }
  };

  return (
    <div class="controls">
      <For each={carr}>
        {(c) => (
          <Control
            content={c.content}
            className={c.className}
            mode={c.mode}
            addingMode={addingMode}
            disabled={!canStep()}
            handleClick={() => handleModeClick(c.mode)}
          />
        )}
      </For>
    </div>
  );
}

// Grid Component
interface GridProps {
  grid: () => TGrid;
  isAdding: () => boolean;
  canStep: () => boolean;
  addingMode: () => AddingMode;
  setAddingMode: (addingMode: AddingMode) => void;
  searching: () => boolean;
  searchStarted: () => boolean;
  setGrid: (grid: TGrid) => void;
  setIsAdding: (isAdding: boolean) => void;
  setStart: (position: TPosition) => void;
  setGoal: (position: TPosition) => void;
  reset: () => void;
  rows: () => number;
  columns: () => number;
}

export function Grid(props: GridProps) {
  const {
    grid,
    isAdding,
    canStep,
    addingMode,
    setAddingMode,
    searching,
    searchStarted,
    setGrid,
    setIsAdding,
    setStart,
    setGoal,
    reset,
    rows,
    columns,
  } = props;

  const validateConstraints = (addingMode: AddingMode) => {
    if (
      addingMode === "START" &&
      Array.from(grid().values()).some((cell) => cell.state.isStart)
    ) {
      return false;
    }

    if (
      addingMode === "GOAL" &&
      Array.from(grid().values()).some((cell) => cell.state.isGoal)
    ) {
      return false;
    }

    return true;
  };

  const maybeAdd = (event: any, clicked?: boolean) => {
    if ((!isAdding() && !clicked) || !canStep()) return;

    const target = event.target;

    const row = Number(target.dataset.row);
    const column = Number(target.dataset.column);

    const clickedCell = grid().get(generateKey(row, column));

    if (!clickedCell) return;

    if (
      (searching() &&
        (clickedCell.state.isStart || clickedCell.state.isGoal)) ||
      (searchStarted() && clickedCell.state.isStart)
    ) {
      reset();
      return;
    }

    if (clickedCell.state.isVisited || clickedCell.state.isQueued) {
      return;
    }

    setGrid((oldGrid) => {
      const newGrid = new Map<string, ICell>(oldGrid);
      const cell = newGrid.get(generateKey(row, column))!;
      if (cell.state.isGoal || cell.state.isStart) return newGrid;

      const newCell = event.metaKey
        ? CellFactory.default()
        : validateConstraints(addingMode())
          ? CellFactory.build(addingMode())
          : cell;

      if (newCell.state.isStart) {
        setStart([row, column]);
        setAddingMode(AddingMode.GOAL);
      } else if (newCell.state.isGoal) {
        setGoal([row, column]);
        setAddingMode(AddingMode.WALL);
      }

      newGrid.set(generateKey(row, column), { ...newCell, id: cell.id });
      return newGrid;
    });
  };

  const handleMouseDown = (event: any) => {
    setIsAdding(true);
    maybeAdd(event, true);
  };

  const stopAdding = () => {
    setIsAdding(false);
  };

  const renderRows = createMemo(() => {
    const rowsArray = [];
    for (let r = 0; r < rows(); r++) {
      const rowArray = [];
      for (let c = 0; c < columns(); c++) {
        const cell = grid().get(generateKey(r, c));
        if (cell) {
          rowArray.push(
            <Cell
              row={r}
              column={c}
              rows={rows}
              columns={columns}
              grid={grid}
              data={cell}
            />,
          );
        }
      }
      rowsArray.push(<div class="row">{rowArray}</div>);
    }
    return rowsArray;
  });

  return (
    <div class="grid-container">
      <div
        onMouseDown={handleMouseDown}
        onMouseUp={stopAdding}
        onMouseLeave={stopAdding}
        onMouseMove={maybeAdd}
        class="grid"
      >
        {renderRows()}
      </div>
    </div>
  );
}

export default function App() {
  const [rows, setRows] = createSignal(INITIAL_ROWS);
  const [columns, setColumns] = createSignal(INITIAL_COLS);
  const [grid, setGrid] = createSignal(initialGrid(rows(), columns()));

  const [strategy, setStrategy] = createSignal(STRATEGIES.BFS);
  const [isAdding, setIsAdding] = createSignal(false);
  const [addingMode, setAddingMode] = createSignal<AddingMode>(
    AddingMode.START,
  );
  const [canStep, setCanStep] = createSignal(true);
  const [searchStarted, setSearchStarted] = createSignal(false);
  const [speed, setSpeed] = createSignal<number>(1);
  const [isSearching, setIsSearching] = createSignal(false);

  let searchGeneratorRef: Generator | null = null;

  const [start, setStart] = createSignal<TPosition>();
  const [goal, setGoal] = createSignal<TPosition>();

  createEffect(() => {
    setGrid(initialGrid(rows(), columns()));
  }, [rows, columns]);

  const generate = () => {
    const threshold = -0.35;
    const smpn = mkSimplexNoise(Math.random);

    const oldStart = start();
    const oldGoal = goal();

    reset();
    setGrid(() => {
      const newGrid = new Map<string, ICell>();
      for (let i = 0; i < rows(); i++) {
        for (let j = 0; j < columns(); j++) {
          const key = generateKey(i, j);
          if (
            Array.isArray(oldStart) &&
            i === oldStart[0] &&
            j === oldStart[1]
          ) {
            setStart(oldStart);
            newGrid.set(key, CellFactory.start());
          } else if (
            Array.isArray(oldGoal) &&
            i === oldGoal[0] &&
            j === oldGoal[1]
          ) {
            setGoal(oldGoal);
            newGrid.set(key, CellFactory.goal());
          } else {
            const noiseValue = smpn.noise2D(i, j);
            if (noiseValue < threshold) {
              newGrid.set(key, CellFactory.wall());
            } else {
              newGrid.set(key, CellFactory.default());
            }
          }
        }
      }
      return newGrid;
    });
  };
  function* search(
    start: TPosition,
    goal: TPosition,
    strategy: SearchStrategy,
  ) {
    const visited = new Set<number>();
    const parentMap = new Map<number, TPosition>();

    const neighbours = getNeighbours(start, grid());
    const startEl = grid().get(generateKey(start[0], start[1]))!;
    const queue = Array.from(neighbours);

    visited.add(startEl.id);
    strategy.initialize(start, goal);

    neighbours.forEach((neighbour) => {
      const [nRow, nCol] = neighbour;
      const neighbourCell = grid().get(generateKey(nRow, nCol))!;
      parentMap.set(neighbourCell.id, start);
    });

    while (queue.length > 0) {
      const newGrid = new Map<string, ICell>(grid());
      const current = strategy.getNextNode(queue, goal);
      if (!current) break;

      const [row, column] = current;
      const currentKey = generateKey(row, column);

      const cell = newGrid.get(currentKey)!;

      if (cell.state.isWall || cell.state.isStart) continue;
      if (visited.has(cell.id)) continue;

      visited.add(cell.id);

      if (cell.state.isGoal) {
        let currentPos = current;
        const path = [];

        while (
          parentMap.has(
            newGrid.get(generateKey(currentPos[0], currentPos[1]))!.id,
          )
        ) {
          path.push(currentPos);
          currentPos = parentMap.get(
            newGrid.get(generateKey(currentPos[0], currentPos[1]))!.id,
          )!;
        }

        path.forEach(([r, c]) => {
          const key = generateKey(r, c);
          if (!newGrid.get(key)!.state.isGoal) {
            newGrid.set(key, {
              ...CellFactory.path(),
              id: newGrid.get(key)!.id,
            });
          }
        });

        setGrid(new Map(newGrid));
        return;
      }

      if (strategy === aStarStrategy) {
        newGrid.forEach((cell, key) => {
          if (cell.state.isPath) {
            cell.state.isPath = false;
          }
        });

        const optimalPath = strategy.getOptimalPath();
        optimalPath.forEach(([r, c]) => {
          const key = generateKey(r, c);
          if (
            !newGrid.get(key)!.state.isGoal &&
            !newGrid.get(key)!.state.isStart
          ) {
            newGrid.set(key, {
              ...CellFactory.path(),
              id: newGrid.get(key)!.id,
            });
          }
        });
      }

      if (strategy !== aStarStrategy) {
        newGrid.set(currentKey, {
          ...CellFactory.visited(),
          id: cell.id,
        });
      }

      const currentPos = [row, column];
      const nextNeighbours = getNeighbours(currentPos, grid());

      nextNeighbours.forEach((neighbour) => {
        const [nRow, nCol] = neighbour;
        const nCell = newGrid.get(generateKey(nRow, nCol))!;
        if (
          !visited.has(nCell.id) &&
          !nCell.state.isWall &&
          strategy.processNeighbour(currentPos, neighbour, parentMap)
        ) {
          queue.push(neighbour);
          parentMap.set(nCell.id, currentPos);
        }
      });

      if (strategy !== aStarStrategy) {
        queue.forEach(([r, c]) => {
          const key = generateKey(r, c);
          if (
            !newGrid.get(key)!.state.isGoal &&
            !newGrid.get(key)!.state.isStart &&
            !newGrid.get(key)!.state.isVisited &&
            !newGrid.get(key)!.state.isWall
          ) {
            newGrid.set(key, {
              ...CellFactory.queued(),
              id: newGrid.get(key)!.id,
            });
          }
        });
      }

      setGrid(new Map(newGrid));
      yield false;
    }

    yield true;
  }

  const getSearchStrategy = () => {
    switch (strategy()) {
      case STRATEGIES.BFS:
        return bfsStrategy;
      case STRATEGIES.DFS:
        return dfsStrategy;
      case STRATEGIES.AStar:
        return aStarStrategy;
      default:
        throw new Error("Unknown strategy");
    }
  };

  const searchWrapper = () => {
    if (!searchGeneratorRef) {
      searchGeneratorRef = search(start()!, goal()!, getSearchStrategy());
    }

    const { done } = searchGeneratorRef.next();

    setCanStep(!done);

    if (done) {
      searchGeneratorRef = null;
    }
  };

  createEffect(() => {
    createTimer(
      searchWrapper,
      () =>
        isSearching() && start() && goal() && canStep()
          ? (1 / speed()) * 1000
          : false,
      setInterval,
    );
  }, [canStep, isSearching, speed]);

  createEffect(() => {
    reset();
  }, [rows, columns]);

  const reset = () => {
    setStart(undefined);
    setGoal(undefined);
    setCanStep(true);
    setIsSearching(false);
    setSearchStarted(false);
    setAddingMode(AddingMode.START);
    searchGeneratorRef = null;
    setGrid(initialGrid(rows(), columns()));
  };

  const onStrategyChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    if (searchStarted()) {
      reset();
    }

    switch (value) {
      case "bfs":
        return setStrategy(STRATEGIES.BFS);
      case "dfs":
        return setStrategy(STRATEGIES.DFS);
      case "a*":
        return setStrategy(STRATEGIES.AStar);
      default:
        throw new Error("Unknown strategy");
    }
  };

  const canSearch = () => Boolean(start()) && Boolean(goal());

  return (
    <div class="container">
      <Grid
        grid={grid}
        isAdding={isAdding}
        canStep={canStep}
        addingMode={addingMode}
        setAddingMode={setAddingMode}
        searching={isSearching}
        searchStarted={searchStarted}
        setGrid={setGrid}
        setIsAdding={setIsAdding}
        setStart={setStart}
        setGoal={setGoal}
        reset={reset}
        rows={rows}
        columns={columns}
      />
      <div class="app-controls">
        <label for="strategy">Strategy:</label>
        <select name="strategy" onChange={onStrategyChange}>
          <option value="bfs">Breadth First Search (BFS)</option>
          <option value="dfs">Depth First Search (DFS)</option>
          <option value="a*">A*</option>
        </select>
        <Controls
          addingMode={addingMode}
          setAddingMode={setAddingMode}
          canStep={canStep}
        />
        <div class="buttons">
          <button
            class={`button button-search ${isSearching() && "searching"}`}
            onClick={() => {
              if (isSearching()) {
                setIsSearching(false);
                return;
              }

              if (start() && goal()) {
                setSearchStarted(true);
                setIsSearching(true);
              }
            }}
            disabled={isSearching() ? !canStep() : !canSearch()}
          >
            {isSearching() ? "STOP" : "SEARCH"}
          </button>
          <button class="button button-reset" onClick={reset}>
            RESET
          </button>
        </div>
        <div class="buttons">
          <button class="button button-generate" onClick={generate}>
            GENERATE
          </button>
        </div>
        <div class="slider-container">
          <label for="speed">Speed:</label>
          <input
            type="range"
            min="0.1"
            max="100"
            value={speed()}
            class="slider"
            name="speed"
            step={0.1}
            onInput={(e) => setSpeed(Number(e.currentTarget.value))}
          />
        </div>
        <div class="slider-container">
          <label for="rows">Rows:</label>
          <input
            type="range"
            min="4"
            max="64"
            value={rows()}
            class="slider"
            name="rows"
            step={1}
            onInput={(e) => setRows(Number(e.currentTarget.value))}
          />
        </div>
        <div class="slider-container">
          <label for="columns">Columns:</label>
          <input
            type="range"
            min="4"
            max="64"
            value={columns()}
            class="slider"
            name="columns"
            step={1}
            onInput={(e) => setColumns(Number(e.currentTarget.value))}
          />
        </div>
        <div class="settings-summary">
          <div class="dimensions-container">
            Dimensions:
            <span class="dimensions">
              {rows()}x{columns()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
