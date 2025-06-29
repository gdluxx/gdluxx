/*
 * Copyright (C) 2025 jsouthgb
 *
 * This file is part of gdluxx.
 *
 * gdluxx is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 (GPL-2.0),
 * as published by the Free Software Foundation.
 */

export interface Option {
  id: string;
  command: string;
  description: string;
}

export interface OptionCategory {
  title: string;
  options: Option[];
}

export type OptionsData = Record<string, OptionCategory>;

export interface SelectedOption extends Option {
  category: string;
}
