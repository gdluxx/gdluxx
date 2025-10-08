/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

declare module '*.css?inline' {
  const content: string;
  export default content;
}

declare module '*.svg?url' {
  const src: string;
  export default src;
}

declare module '*.svg?raw' {
  const markup: string;
  export default markup;
}
