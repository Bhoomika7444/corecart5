/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- Result Pattern ---
export class Result<T, E = Error> {
  private constructor(
    private readonly isSuccessVal: boolean,
    private readonly valueVal?: T,
    private readonly errorVal?: E
  ) {}

  public static ok<T, E = Error>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined);
  }

  public static fail<T, E = Error>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }

  public get isSuccess(): boolean {
    return this.isSuccessVal;
  }

  public get isFailure(): boolean {
    return !this.isSuccessVal;
  }

  public getValue(): T {
    if (!this.isSuccessVal) {
      throw new Error("Cannot get value from failure result: " + String(this.errorVal));
    }
    return this.valueVal!;
  }

  public getError(): E {
    if (this.isSuccessVal) {
      throw new Error("Cannot get error from success result");
    }
    return this.errorVal!;
  }
}

// --- Domain Events ---
export interface DomainEvent<Payload = any> {
  eventId: string;
  eventType: string;
  storeId: string;
  occurredAt: string;
  payload: Payload;
  version: number;
}

// --- Platform Enums & Shared Consts ---
export enum StoreStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  ARCHIVED = "ARCHIVED",
}

export enum ProductStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  OUT_OF_STOCK = "OUT_OF_STOCK",
  ARCHIVED = "ARCHIVED",
}

export enum CartStatus {
  ACTIVE = "ACTIVE",
  CONVERTED = "CONVERTED",
  ABANDONED = "ABANDONED",
}

export enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  PROCESSING = "PROCESSING",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
  RETURN_REQUESTED = "RETURN_REQUESTED",
  RETURNED = "RETURNED",
  REFUNDED = "REFUNDED",
}

export type StoreTemplateKey =
  | "amazon_style"
  | "fashion"
  | "electronics"
  | "furniture"
  | "grocery"
  | "luxury"
  | "minimal"
  | "custom";

export type FeatureKey =
  | "wishlist"
  | "compare_products"
  | "reviews"
  | "coupons"
  | "search_autocomplete"
  | "smart_recommendations"
  | "blog"
  | "faq"
  | "chat"
  | "dark_mode"
  | "flash_deals"
  | "newsletters"
  | "stock_alerts"
  | "analytics_dashboard"
  | "multi_tenant";
