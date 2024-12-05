/**
 * MultiSelect component allows users to select multiple options from a dropdown list.
 * It supports various styles, custom icons, and a search functionality.
 * 
 * @component
 * @param {Object} props - The props for the MultiSelect component.
 * @param {Array} props.options - An array of option objects to be displayed in the multi-select component.
 * @param {string} props.options[].label - The text to display for the option.
 * @param {string} props.options[].value - The unique value associated with the option.
 * @param {React.ComponentType} [props.options[].icon] - Optional icon component to display alongside the option.
 * @param {function} props.onValueChange - Callback function triggered when the selected values change. Receives an array of the new selected values.
 * @param {string[]} [props.defaultValue=[]] - The default selected values when the component mounts.
 * @param {string} [props.placeholder="Select options"] - Placeholder text to be displayed when no values are selected.
 * @param {number} [props.maxCount=3] - Maximum number of items to display. Extra selected items will be summarized.
 * @param {boolean} [props.modalPopover=false] - The modality of the popover. When set to true, interaction with outside elements will be disabled and only popover content will be visible to screen readers.
 * @param {boolean} [props.asChild=false] - If true, renders the multi-select component as a child of another component.
 * @param {string} [props.className] - Additional class names to apply custom styles to the multi-select component.
 * @param {React.Ref<HTMLButtonElement>} ref - Ref to the button element.
 * @returns {JSX.Element} The rendered MultiSelect component.
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
    CheckIcon,
    ChevronDown,
    CheckCheckIcon,
    X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";

/**
 * Variants for the multi-select component to handle different styles.
 * Uses class-variance-authority (cva) to define different styles based on "variant" prop.
 */
const multiSelectVariants = cva(
    "m-1 transition-scale-zoom",
    {
        variants: {
            variant: {
                default:
                    "border-foreground/10 text-foreground bg-card hover:bg-card/80",
                secondary:
                    "border-foreground/10 bg-secondary text-secondary-foreground hover:bg-secondary/80",
                destructive:
                    "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
                inverted: "inverted",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

/**
 * Props for MultiSelect component
 */
interface MultiSelectProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof multiSelectVariants> {
    /**
     * An array of option objects to be displayed in the multi-select component.
     * Each option object has a label, value, and an optional icon.
     */
    options: {
        /** The text to display for the option. */
        label: string;
        /** The unique value associated with the option. */
        value: string;
        /** Optional icon component to display alongside the option. */
        icon?: React.ComponentType<{ className?: string }>;
    }[];

    /**
     * Callback function triggered when the selected values change.
     * Receives an array of the new selected values.
     */
    onValueChange: (value: string[]) => void;

    /** The default selected values when the component mounts. */
    defaultValue?: string[];

    /**
     * Placeholder text to be displayed when no values are selected.
     * Optional, defaults to "Select options".
     */
    placeholder?: string;

    /**
     * Maximum number of items to display. Extra selected items will be summarized.
     * Optional, defaults to 3.
     */
    maxCount?: number;

    /**
     * The modality of the popover. When set to true, interaction with outside elements
     * will be disabled and only popover content will be visible to screen readers.
     * Optional, defaults to false.
     */
    modalPopover?: boolean;

    /**
     * If true, renders the multi-select component as a child of another component.
     * Optional, defaults to false.
     */
    asChild?: boolean;

    /**
     * Additional class names to apply custom styles to the multi-select component.
     * Optional, can be used to add custom styles.
     */
    className?: string;
}

export const MultiSelect = React.forwardRef<
    HTMLButtonElement,
    MultiSelectProps
>(
    (
        {
            options,
            onValueChange,
            variant,
            defaultValue = [],
            placeholder = "Select options",
            maxCount = 3,
            modalPopover = false,
            asChild = false,
            className,
            ...props
        },
        ref
    ) => {
        const [selectedValues, setSelectedValues] =
            React.useState<string[]>(defaultValue);
        const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

        const handleInputKeyDown = (
            event: React.KeyboardEvent<HTMLInputElement>
        ) => {
            if (event.key === "Enter") {
                setIsPopoverOpen(true);
            } else if (event.key === "Backspace" && !event.currentTarget.value) {
                const newSelectedValues = [...selectedValues];
                newSelectedValues.pop();
                setSelectedValues(newSelectedValues);
                onValueChange(newSelectedValues);
            }
        };

        const toggleOption = (option: string) => {
            const newSelectedValues = selectedValues.includes(option)
                ? selectedValues.filter((value) => value !== option)
                : [...selectedValues, option];
            setSelectedValues(newSelectedValues);
            onValueChange(newSelectedValues);
        };

        const handleClear = () => {
            setSelectedValues([]);
            onValueChange([]);
        };

        const handleTogglePopover = () => {
            setIsPopoverOpen((prev) => !prev);
        };

        const clearExtraOptions = () => {
            const newSelectedValues = selectedValues.slice(0, maxCount);
            setSelectedValues(newSelectedValues);
            onValueChange(newSelectedValues);
        };

        const toggleAll = () => {
            if (selectedValues.length === options.length) {
                handleClear();
            } else {
                const allValues = options.map((option) => option.value);
                setSelectedValues(allValues);
                onValueChange(allValues);
            }
        };

        return (
            <Popover
                open={isPopoverOpen}
                onOpenChange={setIsPopoverOpen}
                modal={modalPopover}
            >
                <PopoverTrigger asChild>
                    <Button
                        ref={ref}
                        {...props}
                        onClick={handleTogglePopover}
                        className={cn(
                            "flex flex-grow text-foreground rounded-md border min-h-10 h-auto items-center justify-between bg-inherit hover:bg-inherit [&_svg]:pointer-events-auto",
                            className
                        )}
                    >
                        {selectedValues.length > 0 ? (
                            <div className="flex justify-between items-center w-full">
                                <div className="flex flex-wrap items-center">
                                    {maxCount === 0 && selectedValues.length === 1 ? (
                                        (() => {
                                            const value = selectedValues[0];
                                            const option = options.find((o) => o.value === value);
                                            const IconComponent = option?.icon;
                                            return (
                                                <div className="flex items-center">
                                                    {IconComponent && (
                                                        <IconComponent className="h-4 w-4 mr-2" />
                                                    )}
                                                    <span className="text-sm">{option?.label}</span>
                                                </div>
                                            );
                                        })()
                                    ) : (
                                        <span className="text-sm">
                                            {selectedValues.length === options.length ? 'All' : `${selectedValues.length} selected`}
                                        </span>
                                    )}
                                </div>
                                <X
                                    className="ml-2 h-4 w-4 cursor-pointer text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleClear();
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-between w-full mx-auto">
                                <span className="text-sm text-muted-foreground">
                                    {placeholder}
                                </span>
                            </div>
                        )}
                        <ChevronDown className="h-4 cursor-pointer text-muted-foreground" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-auto p-0 border-none"
                    align="start"
                    onEscapeKeyDown={() => setIsPopoverOpen(false)}
                >
                    <Command className="custom-shadow">
                        <CommandInput
                            placeholder="Search..."
                            onKeyDown={handleInputKeyDown}
                        />
                        <CommandList>
                            <CommandEmpty>No results found.</CommandEmpty>
                            <CommandGroup>
                                <CommandItem
                                    key="all"
                                    onSelect={toggleAll}
                                    className="cursor-pointer"
                                >
                                    <span>Select All</span>
                                    <div className="flex-1" />
                                    <div
                                        className={cn(
                                            "flex h-4 w-4 items-center justify-center",
                                            selectedValues.length === options.length
                                                ? ""
                                                : "[&_svg]:invisible"
                                        )}
                                    >
                                        <CheckCheckIcon className="h-4 w-4" />
                                    </div>
                                </CommandItem>
                                <CommandSeparator className="my-1 h-[0.5px]" />
                                {options.map((option) => {
                                    const isSelected = selectedValues.includes(option.value);
                                    return (
                                        <CommandItem
                                            key={option.value}
                                            onSelect={() => toggleOption(option.value)}
                                            className="cursor-pointer"
                                        >
                                            {option.icon && (
                                                <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span>{option.label}</span>
                                            <div className="flex-1" />
                                            <div
                                                className={cn(
                                                    "flex h-4 w-4 items-center justify-center",
                                                    isSelected
                                                        ? ""
                                                        : "[&_svg]:invisible"
                                                )}
                                            >
                                                <CheckIcon className="h-4 w-4" />
                                            </div>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        );
    }
);

MultiSelect.displayName = "MultiSelect";