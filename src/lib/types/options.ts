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
