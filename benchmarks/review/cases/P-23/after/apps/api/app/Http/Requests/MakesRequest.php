<?php

namespace App\Http\Requests;

use App\Domain\Leasing\CustomerType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MakesRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'customer_type' => ['sometimes', Rule::enum(CustomerType::class)],
        ];
    }

    /** Private customers are the default audience, as in the offer search. */
    public function customerType(): CustomerType
    {
        $type = $this->validated('customer_type');

        return $type === null ? CustomerType::Private : CustomerType::from((string) $type);
    }
}
