// Original Windows XP Luna (blue) colours for the authentic XP widgets (ADR 0004, doc/scenes/windows-xp.md).
// Without the luna.msstyles bitmaps, colours come from original screenshots and common Luna recreations; gradients are [offset 0…1, colour] lists.
// Separate from tokens.ts THEMES.xp (design-system proposal), which still styles game UI such as the turn banner.

export type GradientStops = readonly (readonly [offset: number, color: string])[];

export const LUNA = {
  /** Window and button face (the "3D objects" colour) */
  face: '#ece9d8',
  ink: '#000000',
  inkDisabled: '#aca899',
  white: '#ffffff',
  /** 3D edges: highlight, shadow, dark shadow (Luna ButtonHighlight / ButtonShadow / ButtonDkShadow) */
  edgeHighlight: '#ffffff',
  edgeShadow: '#aca899',
  edgeDarkShadow: '#716f64',
  /** Blue behind selected items and highlighted menu items */
  selection: '#316ac5',
  /** Shadow under desktop icon labels */
  desktopTextShadow: '#000000',
  /** Edit control (text box): Luna's thin blue-grey border around a white field */
  edit: { border: '#7f9db9', fill: '#ffffff' },
  /** HackerEditor's lanes (doc/chart-editor.md), after Windows Movie Maker 2's timeline: grey lines, blue and green clips */
  hackerEditor: {
    line: '#c9c7ba',
    beat: '#8a877a',
    call: '#7aa7e8',
    response: '#8cc97a',
    problem: '#d0312d',
  },

  window: {
    caption: [
      [0, '#0997ff'],
      [0.08, '#0053ee'],
      [0.4, '#0050ee'],
      [0.88, '#0066ff'],
      [0.93, '#0066ff'],
      [0.95, '#005bff'],
      [0.96, '#003dd7'],
      [1, '#003dd7'],
    ] as GradientStops,
    captionInactive: [
      [0, '#a6baf0'],
      [0.08, '#7f9be6'],
      [0.4, '#7a96df'],
      [0.88, '#8aa5ea'],
      [0.95, '#7e9ae2'],
      [1, '#6f8bd6'],
    ] as GradientStops,
    captionText: '#ffffff',
    captionTextShadow: '#0f1089',
    captionTextInactive: '#d8e4f8',
    /** Highlight along the top and left of the title bar */
    captionEdgeLight: '#0831d9',
    captionEdgeLightInactive: '#9fb4ea',
    /** Three frame rings, outside in: one set for top-left, one for bottom-right */
    frameLight: ['#0831d9', '#166aee', '#0855dd'],
    frameDark: ['#00138c', '#001ea0', '#003bda'],
    frameLightInactive: ['#8ea6e6', '#a6baf0', '#9fb4ea'],
    frameDarkInactive: ['#6077c0', '#6b85cf', '#7a96df'],
  },

  closeButton: {
    border: '#ffffff',
    fill: [
      [0, '#f0a589'],
      [0.25, '#e4704f'],
      [0.6, '#d5462a'],
      [1, '#c1351a'],
    ] as GradientStops,
    glyph: '#ffffff',
  },

  /** Title bar minimise / maximise buttons: thin white edge, blue gradient, white glyph */
  captionButton: {
    border: '#ffffff',
    fill: [
      [0, '#9dbcf9'],
      [0.25, '#5b90f5'],
      [0.6, '#3a73ee'],
      [1, '#2257d5'],
    ] as GradientStops,
    glyph: '#ffffff',
  },

  button: {
    border: '#003c74',
    fill: [
      [0, '#ffffff'],
      [0.86, '#ecebe6'],
      [1, '#d6d0c5'],
    ] as GradientStops,
    pressedFill: [
      [0, '#cdcac3'],
      [0.08, '#e3e3db'],
      [0.94, '#e5e4de'],
      [1, '#f2f1ec'],
    ] as GradientStops,
    /** Blue inner rings of the default (Enter) button: ring 1, ring 2, each top, sides, bottom */
    defaultRings: [
      ['#cee7ff', '#bcd4f6', '#89ade4'],
      ['#bcd4f6', '#98b8ea', '#89ade4'],
    ],
    /** Orange inner rings on hover */
    hotRings: [
      ['#fff0cf', '#fbc761', '#e5a01a'],
      ['#fdd889', '#fbc761', '#e5a01a'],
    ],
  },

  /** Latency test beat dots (doc/latency-test.md), after the settings board of the main screen designs */
  latencyTest: {
    well: '#ffffff',
    wellEdge: '#7f9db9',
    ring: '#7f9db9',
    ringCurrent: '#e5a01a',
    fillCurrent: '#ffd85a',
    fillPressed: '#c1d3fb',
    mark: '#e5a01a',
  },

  checkbox: {
    border: '#1c5180',
    fill: [
      [0, '#dcdcd7'],
      [1, '#ffffff'],
    ] as GradientStops,
    check: '#21a121',
    /** Orange inner ring while the mouse is over the box */
    hot: '#f8b33f',
  },

  /** Progress bar (msctls_progress32): thin grey rounded border, white track, green blocks */
  progress: {
    border: '#686868',
    track: '#ffffff',
    chunk: [
      [0, '#d2f7d2'],
      [0.45, '#3fd23f'],
      [1, '#8ce68c'],
    ] as GradientStops,
  },

  trackbar: {
    channelFill: '#f4f3ee',
    channelDark: '#9d9c99',
    channelLight: '#ffffff',
    tick: '#a1a192',
    thumbBorder: '#7f9db9',
    thumbBorderHot: '#e5a01a',
    thumbFill: [
      [0, '#ffffff'],
      [0.7, '#f1f0ea'],
      [1, '#d9d8cf'],
    ] as GradientStops,
  },

  taskbar: {
    fill: [
      [0, '#1f2f86'],
      [0.03, '#3165c4'],
      [0.06, '#3682e5'],
      [0.1, '#4490e6'],
      [0.12, '#3883e5'],
      [0.15, '#2b71e0'],
      [0.18, '#2663da'],
      [0.2, '#235bd6'],
      [0.23, '#2258d5'],
      [0.38, '#2157d6'],
      [0.54, '#245ddb'],
      [0.86, '#2562df'],
      [0.89, '#245fdc'],
      [0.92, '#2158d4'],
      [0.95, '#1d4ec0'],
      [1, '#1941a5'],
    ] as GradientStops,
    trayFill: [
      [0, '#0c59b9'],
      [0.06, '#139ee9'],
      [0.1, '#18b5f2'],
      [0.14, '#139beb'],
      [0.19, '#1290e8'],
      [0.63, '#0d8dea'],
      [0.81, '#0d9ff1'],
      [0.88, '#0f9eed'],
      [0.91, '#119be9'],
      [0.94, '#1392e2'],
      [0.97, '#137ed7'],
      [1, '#095bc9'],
    ] as GradientStops,
    /** Taskbar program buttons: normal (window behind or minimised) and pressed (window in front) */
    taskButton: [
      [0, '#5a9bf7'],
      [0.12, '#3c81f3'],
      [0.9, '#3a7cee'],
      [1, '#2b65d6'],
    ] as GradientStops,
    taskButtonActive: [
      [0, '#174ba8'],
      [0.15, '#1e52b7'],
      [1, '#2259c4'],
    ] as GradientStops,
    taskButtonEdge: '#0f3fa3',
    trayBorder: '#1042af',
    trayHighlight: '#18bbff',
    text: '#ffffff',
  },

  startButton: {
    fill: [
      [0, '#3c8f3c'],
      [0.06, '#6cc16c'],
      [0.14, '#55b455'],
      [0.45, '#40a53f'],
      [0.8, '#36963a'],
      [0.94, '#2f8732'],
      [1, '#1f6a22'],
    ] as GradientStops,
    /** Dark outline of the right-hand curved edge */
    edge: '#1d5f1d',
    text: '#ffffff',
    textShadow: '#184d18',
  },

  startMenu: {
    header: [
      [0, '#1868ce'],
      [0.12, '#0e60cb'],
      [0.2, '#0e60cb'],
      [0.32, '#1164cf'],
      [0.33, '#1667cf'],
      [0.47, '#1b6cd3'],
      [0.54, '#1e70d9'],
      [0.6, '#2476dc'],
      [0.65, '#297ae0'],
      [0.77, '#3482e3'],
      [0.79, '#3786e5'],
      [0.9, '#428ee9'],
      [1, '#4791eb'],
    ] as GradientStops,
    footer: [
      [0, '#4282d6'],
      [0.03, '#3b85e0'],
      [0.05, '#418ae3'],
      [0.17, '#418ae3'],
      [0.21, '#3c87e2'],
      [0.26, '#3786e4'],
      [0.29, '#3482e3'],
      [0.39, '#2e7ee1'],
      [0.49, '#2374df'],
      [0.57, '#2072db'],
      [0.62, '#196edb'],
      [0.72, '#176bd8'],
      [0.75, '#1468d8'],
      [0.83, '#1165d4'],
      [1, '#0f61cb'],
    ] as GradientStops,
    /** Orange divider under the user bar (brightest in the middle, transparent at the ends) */
    accentLine: [
      [0, '#da884a00'],
      [0.5, '#da884aff'],
      [1, '#da884a00'],
    ] as GradientStops,
    frame: '#3a6fd0',
    left: '#ffffff',
    right: '#d3e5fa',
    rightBorder: '#95bdee',
    leftSeparator: [
      [0, '#00000000'],
      [0.5, '#0000001f'],
      [1, '#00000000'],
    ] as GradientStops,
    rightSeparator: [
      [0, '#87b3e200'],
      [0.5, '#87b3e2ff'],
      [1, '#87b3e200'],
    ] as GradientStops,
    subtitle: '#8d8d8d',
    rightText: '#0a246a',
    headerText: '#ffffff',
    headerTextShadow: '#00000099',
    footerHot: '#ffffff33',
    /** Vector stand-in for the Control Panel icon (start-menu.ts): window frame, face, applet tiles, slider groove */
    controlPanelIcon: {
      frame: '#2f62c8',
      face: '#f4f1e4',
      tileRed: '#e0503a',
      tileGreen: '#3c9a3c',
      tileYellow: '#e8b52e',
      slider: '#9a9a8c',
    },
    allProgramsArrow: [
      [0, '#7bd97b'],
      [0.5, '#35a235'],
      [1, '#257d25'],
    ] as GradientStops,
  },

  /** Explorer (CabinetWClass): menu bar, toolbar, address bar, task pane, tiles view, status bar */
  explorer: {
    /** Divider between toolbar and address bar: one dark, one light */
    bandDark: '#d0d0bf',
    bandLight: '#ffffff',
    toolbarSeparator: '#c5c2b2',
    /** Raised edge of toolbar buttons on hover */
    hotEdgeLight: '#ffffff',
    hotEdgeDark: '#aca899',
    disabledInk: '#aca899',
    addressLabel: '#444444',
    comboBorder: '#7f9db9',
    comboButton: [
      [0, '#e1eafe'],
      [1, '#b4c9f5'],
    ] as GradientStops,
    comboButtonEdge: '#b9cdf6',
    comboArrow: '#4d6185',
    /** Green round arrows for Back, Go and similar */
    go: '#3aa63a',
    goEdge: '#1d6a1d',
    goDisabled: '#c9c7ba',
    goDisabledEdge: '#a1a192',
    taskPane: [
      [0, '#7ba2e7'],
      [1, '#6375d6'],
    ] as GradientStops,
    groupHeader: [
      [0, '#ffffff'],
      [1, '#c6d3f7'],
    ] as GradientStops,
    groupHeaderText: '#215dc6',
    groupBody: '#d6dff7',
    link: '#215dc6',
    linkHot: '#428eff',
    /** Group header in "Show in groups" tiles view, with a line fading out underneath */
    viewGroupTitle: '#0e3ea4',
    viewGroupLine: [
      [0, '#8ba8e0ff'],
      [0.7, '#8ba8e000'],
      [1, '#8ba8e000'],
    ] as GradientStops,
    subText: '#7a7a7a',
    /** Blue tint over selected icons */
    selectedIconTint: '#9db8ec',
  },

  /** Pale yellow of info tips (balloons, tooltips) */
  tooltip: {
    fill: '#ffffe1',
    border: '#000000',
  },

  /** Red no-entry sign on the muted tray speaker */
  speaker: {
    mute: '#e0301e',
  },
} as const;
