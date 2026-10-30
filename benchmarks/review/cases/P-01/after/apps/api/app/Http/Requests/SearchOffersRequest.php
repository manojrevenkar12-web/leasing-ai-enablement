<?php

namespace App\Http\Requests;

use App\Domain\Leasing\CustomerType;
use App\Models\Vehicle;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SearchOffersRequest extends FormRequest
{
    public const SORTS = ['factor', 'rate', 'total', 'newest'];

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'make' => ['sometimes', 'string', 'max:40'],
            'model' => ['sometimes', 'string', 'max:60'],
            'fuel' => ['sometimes', Rule::in(Vehicle::FUELS)],
            'customer_type' => ['sometimes', Rule::enum(CustomerType::class)],
            'max_rate_eur' => ['sometimes', 'integer', 'min:1', 'max:10000'],
            'max_down_eur' => ['sometimes', 'integer', 'min:0', 'max:50000'],
            'term' => ['sometimes', 'integer', Rule::in(config('leasing.terms_months'))],
            'km' => ['sometimes', 'integer', Rule::in(config('leasing.mileages_km'))],
            'sort' => ['sometimes', Rule::in(self::SORTS)],
            'page' => ['sometimes', 'integer', 'min:1', 'max:1000'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:'.config('leasing.search.max_per_page')],
        ];
    }

    /**
     * The filters in one canonical form: defaults filled in, strings trimmed and lower-cased, so
     * "?make=VW" and "?make=vw&sort=factor" share one cache entry.
     *
     * @return array{make: ?string, model: ?string, fuel: ?string, customer_type: string, max_rate_eur: ?int, term: ?int, km: ?int, sort: string, page: int, per_page: int}
     */
    public function filters(): array
    {
        $v = $this->validated();
        $text = fn (string $k): ?string => isset($v[$k]) ? mb_strtolower(trim((string) $v[$k])) : null;
        $int = fn (string $k): ?int => isset($v[$k]) ? (int) $v[$k] : null;

        return [
            'make' => $text('make'),
            'model' => $text('model'),
            'fuel' => $text('fuel'),
            'customer_type' => (string) ($v['customer_type'] ?? CustomerType::Private->value),
            'max_rate_eur' => $int('max_rate_eur'),
            'term' => $int('term'),
            'km' => $int('km'),
            'sort' => (string) ($v['sort'] ?? 'factor'),
            'page' => (int) ($v['page'] ?? 1),
            'per_page' => (int) ($v['per_page'] ?? config('leasing.search.per_page')),
        ];
    }
}
