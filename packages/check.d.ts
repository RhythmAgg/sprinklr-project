/**
 *  Created by Aneree on 03/11/20.
 */
import { Dispatch, ReactNode, SetStateAction } from 'react';
import { SelectProps, Option, Value, OnChangeParams } from '../select/types';
export declare type SetStateFunc<S> = Dispatch<SetStateAction<S>>;
export declare type Id = string | number;
export declare type AllOptionsMap = Record<Id, Option>;
export declare type GroupedOptions = Record<string, Array<Option>>;
export declare type LoadOptions = (input: string, groupFilters: {
    group: string;
    pageNumber: number;
}[]) => Promise<{
    groups: Array<{
        group: string;
        options: Array<Option>;
        complete: boolean;
        count?: number;
    }>;
}>;
export declare type AsyncSelectValue = Array<Id | Option> | Value;
declare type BaseAsyncSelectProps = Omit<SelectProps, 'isLoading' | 'options' | 'value' | 'onChange' | 'scrollContainer'> & {
    paginationBuffer?: number;
    searchingText?: ReactNode;
    minimumInput?: number;
    debounceInterval?: number;
    loadOnFocus?: boolean;
    loadOnMount?: boolean;
    listenAllInputChanges?: boolean;
    value?: AsyncSelectValue;
    onChange?: (params: OnChangeParams & {
        valueKeys: Id[];
    }) => unknown;
    resolveValuesOnUpdate?: boolean;
    hideUnresolvedValues?: boolean;
    moveSelectedOptionsToTop?: boolean;
};
export declare type AsyncSelectProps = BaseAsyncSelectProps & {
    loadOptions: (input: string, page: number) => Promise<{
        options: Array<Option>;
        complete: boolean;
    }>;
    initialOptions?: Array<Option>;
    resolveSelectedOptions?: (unresolvedValueKeys: Array<Id>) => Promise<Array<Option>>;
};
export declare type GroupConfig = Array<{
    id: string;
    label: string;
}>;
export declare type GroupedValue = Record<string, AsyncSelectValue>;
export declare type GroupedAsyncSelectProps = Omit<BaseAsyncSelectProps, 'creatable' | 'onChange' | 'value'> & {
    loadOptions: (input: string, groupFilters: Array<{
        group: string;
        pageNumber: number;
    }>) => Promise<{
        groups: {
            group: string;
            options: Array<Option>;
            complete: boolean;
            count?: number;
        }[];
    }>;
    initialOptions?: Record<string, Array<Option>>;
    groupConfig: GroupConfig;
    initialExpandedCount?: number;
    resolveSelectedOptions?: (groupVsUnresolvedValueKeys: Record<string, Array<Id>>) => Promise<GroupedOptions>;
    value?: GroupedValue;
    onChange?: (params: Omit<OnChangeParams, 'value'> & {
        value: GroupedOptions;
        valueKeys: Record<string, Id[]>;
    }) => unknown;
    showSelectAll?: boolean;
    selectAllSelected?: boolean;
};
export type { Value, Option };
