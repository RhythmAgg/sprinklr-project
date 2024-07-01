import { Override } from '../overrides';
import { Color, ColorResult } from 'react-color';
import { GRADIENT_TYPE } from './constants';
import { SelectProps } from '../select';
import { ButtonProps } from '../button';
import { BoxProps } from '../box';
export declare type ColorPickerOverrides = {
    Root?: Override<Record<string, any>>;
    Heading?: Override<Record<string, any>>;
    Swatches?: Override<Record<string, any>>;
    Swatch?: Override<Record<string, any>>;
    TickIcon?: Override<Record<string, any>>;
    Select?: Override<SelectProps & Record<string, any>>;
    ResetButton?: Override<ButtonProps & Record<string, any>>;
    ColorSelectorContainer?: Override<BoxProps & Record<string, any>>;
};
export declare type ColorPickerProps = {
    overrides?: ColorPickerOverrides;
    value?: string;
    onChange?: onChangeCallback;
    onChangeComplete?: onChangeCallback;
    heading?: string;
    resetButtonLabel?: string;
    enableGradientSelector?: boolean;
};
export declare type GradientColorResult = {
    gradientType: (typeof GRADIENT_TYPE)[keyof typeof GRADIENT_TYPE];
    firstColor: string;
    secondColor: string;
    degree: [number];
    endPoints: [number, number];
};
declare type onChangeCallback = (colorString?: string, colorObj?: {
    type: 'solid';
    colorResultObj?: ColorResult;
} | {
    type: 'gradient';
    colorResultObj?: GradientColorResult;
}) => void;
export declare type GradientColorPickerProps = {
    color?: string;
    onChange?: onChangeCallback;
    onChangeComplete?: onChangeCallback;
};
export declare type ColorSelectorProps = {
    selectedTab: number;
    color?: string;
    onChange?: onChangeCallback;
    onChangeComplete?: onChangeCallback;
    overrides?: ColorPickerOverrides;
    setColor: (color: string | undefined) => void;
};
export declare type CustomColorSelectorProps = {
    color?: string;
    onChange: (color: Color | {
        hex: string;
    }) => void;
    hex?: ColorResult['hex'];
    rgb?: ColorResult['rgb'];
    onChangeComplete: (color: Color | {
        hex: string;
    }) => void;
};
export {};
