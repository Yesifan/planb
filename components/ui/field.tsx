"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("flex flex-col gap-8", className)}
      {...props}
    />
  );
}

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field"
      className={cn("group/field flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="field-label"
      className={cn(
        "text-foreground flex items-center gap-2 text-sm font-medium",
        "group-data-[invalid=true]/field:text-destructive",
        className,
      )}
      {...props}
    />
  );
}

function FieldDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function FieldError({
  className,
  errors,
  ...props
}: React.ComponentProps<"p"> & {
  errors?: (string | undefined)[];
}) {
  if (!errors?.length) {
    return null;
  }

  const firstError = errors.find((e) => e);

  if (!firstError) {
    return null;
  }

  return (
    <p
      data-slot="field-error"
      className={cn("text-destructive text-sm font-medium", className)}
      {...props}
    >
      {firstError}
    </p>
  );
}

export { Field, FieldDescription, FieldError,FieldGroup, FieldLabel };
