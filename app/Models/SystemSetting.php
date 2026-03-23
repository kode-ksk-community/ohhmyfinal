<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * SystemSetting Model
 *
 * Stores global app configuration as key-value pairs.
 * Managed exclusively by Super Admin.
 *
 * Usage:
 *   SystemSetting::get('app_name')          → 'FeedbackPro'
 *   SystemSetting::set('app_name', 'MyApp') → updates or creates
 *
 * @property int    $id
 * @property string $key
 * @property string $value
 * @property string $label
 * @property string $group
 * @property string $type
 */
class SystemSetting extends Model
{
    protected $fillable = [
        'key',
        'value',
        'label',
        'group',
        'type',
    ];

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Get a setting value by key.
     * Returns $default if the key doesn't exist.
     *
     * Usage: SystemSetting::get('app_name', 'MyApp')
     */
    public static function get(string $key, mixed $default = null): mixed
    {
        $setting = static::where('key', $key)->first();
        return $setting ? $setting->value : $default;
    }

    /**
     * Set a setting value by key (upsert).
     * Creates the record if it doesn't exist.
     *
     * Usage: SystemSetting::set('app_name', 'FeedbackPro')
     */
    public static function set(string $key, mixed $value): static
    {
        return static::updateOrCreate(
            ['key' => $key],
            ['value' => $value]
        );
    }

    /**
     * Get all settings as a flat key-value array.
     * Useful for passing settings to the frontend via Inertia shared data.
     *
     * Usage: SystemSetting::allAsArray()
     * Returns: ['app_name' => 'FeedbackPro', 'dark_mode_enabled' => '1', ...]
     */
    public static function allAsArray(): array
    {
        return static::all()->pluck('value', 'key')->toArray();
    }
}