<?php

namespace App\Support;

/**
 * Every ingredient, in Bengali.
 *
 * The app is being shown in Dhaka to people who buy পেঁয়াজ, not onions. Showing
 * the Bengali name beside the English one is the difference between a demo that
 * happens to be in Bangladesh and one that is for Bangladesh — and it costs a
 * lookup table.
 *
 * The English name stays as the canonical key: recipes, the detector vocabulary
 * and the alias table all resolve through it, so this is display only and
 * nothing downstream has to care. Anything without an entry simply shows its
 * English name.
 *
 * Where a word is a loan word in everyday Bengali — মাশরুম, পাস্তা, চকলেট — that
 * is what is written here, because it is what people actually say. Inventing a
 * purer Bengali term nobody uses would make the label less useful, not more.
 */
class BengaliNames
{
    /** @var array<string, string> ingredient slug => Bengali name */
    private const NAMES = [
        // ── Produce ──────────────────────────────────────────────────
        'onion' => 'পেঁয়াজ',
        'garlic' => 'রসুন',
        'tomato' => 'টমেটো',
        'potato' => 'আলু',
        'carrot' => 'গাজর',
        'bell-pepper' => 'ক্যাপসিকাম',
        'spinach' => 'পালং শাক',
        'mushroom' => 'মাশরুম',
        'ginger' => 'আদা',
        'green-chilli' => 'কাঁচা মরিচ',
        'lemon' => 'লেবু',
        'lime' => 'কাগজি লেবু',
        'coriander' => 'ধনেপাতা',
        'basil' => 'বেসিল পাতা',
        'parsley' => 'পার্সলে',
        'spring-onion' => 'পেঁয়াজ পাতা',
        'cucumber' => 'শসা',
        'avocado' => 'অ্যাভোকাডো',
        'broccoli' => 'ব্রকলি',
        'cauliflower' => 'ফুলকপি',
        'cabbage' => 'বাঁধাকপি',
        'aubergine' => 'বেগুন',
        'courgette' => 'জুকিনি',
        'sweet-potato' => 'মিষ্টি আলু',
        'apple' => 'আপেল',
        'banana' => 'কলা',
        'mango' => 'আম',
        'orange' => 'কমলা',
        'pea' => 'মটরশুঁটি',
        'sweetcorn' => 'ভুট্টা',

        // ── Meat ─────────────────────────────────────────────────────
        'chicken-breast' => 'মুরগির বুকের মাংস',
        'chicken-thigh' => 'মুরগির রানের মাংস',
        'beef-mince' => 'গরুর কিমা',
        'lamb' => 'খাসির মাংস',
        'pork' => 'শূকরের মাংস',
        'bacon' => 'বেকন',

        // ── Fish ─────────────────────────────────────────────────────
        'prawn' => 'চিংড়ি',
        'salmon' => 'স্যামন মাছ',
        'white-fish' => 'সাদা মাছ',
        'tuna' => 'টুনা মাছ',
        'hilsa' => 'ইলিশ মাছ',
        'rohu' => 'রুই মাছ',

        // ── Dairy and eggs ───────────────────────────────────────────
        'egg' => 'ডিম',
        'milk' => 'দুধ',
        'butter' => 'মাখন',
        'yoghurt' => 'দই',
        'cheddar-cheese' => 'চেডার পনির',
        'parmesan' => 'পারমেসান পনির',
        'mozzarella' => 'মোজারেলা পনির',
        'cream' => 'ক্রিম',

        // ── Pantry ───────────────────────────────────────────────────
        'coconut-milk' => 'নারকেলের দুধ',
        'rice' => 'চাল',
        'pastum' => 'পাস্তা',
        'flour' => 'ময়দা',
        'sugar' => 'চিনি',
        'salt' => 'লবণ',
        'water' => 'পানি',
        'black-pepper' => 'গোলমরিচ',
        'olive-oil' => 'অলিভ অয়েল',
        'vegetable-oil' => 'সয়াবিন তেল',
        'mustard-oil' => 'সরিষার তেল',
        'mustard-paste' => 'সরিষা বাটা',
        'soy-sauce' => 'সয়া সস',
        'vinegar' => 'ভিনেগার',
        'honey' => 'মধু',
        'tomato-paste' => 'টমেটো পেস্ট',
        'chopped-tomato' => 'কাটা টমেটো',
        'chickpea' => 'ছোলা',
        'lentil' => 'মসুর ডাল',
        'black-bean' => 'কালো শিম',
        'stock' => 'ঝোল',
        'tofu' => 'টোফু',
        'peanut-butter' => 'পিনাট বাটার',
        'almond' => 'কাঠবাদাম',
        'cashew' => 'কাজুবাদাম',
        'oat' => 'ওটস',
        'noodle' => 'নুডলস',
        'breadcrumb' => 'ব্রেডক্রাম্ব',
        'baking-powder' => 'বেকিং পাউডার',
        'yeast' => 'ইস্ট',
        'chocolate' => 'চকলেট',
        'vanilla' => 'ভ্যানিলা',

        // ── Bakery ───────────────────────────────────────────────────
        'bread' => 'পাউরুটি',
        'tortilla' => 'টর্টিলা',

        // ── Spices ───────────────────────────────────────────────────
        'cumin' => 'জিরা',
        'coriander-powder' => 'ধনে গুঁড়া',
        'turmeric' => 'হলুদ',
        'chilli-powder' => 'মরিচ গুঁড়া',
        'paprika' => 'পাপ্রিকা',
        'garam-masala' => 'গরম মসলা',
        'panch-phoron' => 'পাঁচফোড়ন',
        'cinnamon' => 'দারুচিনি',
        'oregano' => 'অরিগ্যানো',
        'thyme' => 'থাইম',
        'bay-leaf' => 'তেজপাতা',
        'cardamom' => 'এলাচ',
        'curry-powder' => 'কারি পাউডার',

        // ── Added with the wider detector vocabulary ─────────────────
        'strawberry' => 'স্ট্রবেরি',
        'blueberry' => 'ব্লুবেরি',
        'grape' => 'আঙুর',
        'watermelon' => 'তরমুজ',
        'pineapple' => 'আনারস',
        'papaya' => 'পেঁপে',
        'guava' => 'পেয়ারা',
        'pear' => 'নাশপাতি',
        'peach' => 'পীচ',
        'kiwi' => 'কিউই',
        'coconut' => 'নারকেল',
        'okra' => 'ঢেঁড়স',
        'bottle-gourd' => 'লাউ',
        'bitter-gourd' => 'করলা',
        'pointed-gourd' => 'পটল',
        'pumpkin' => 'মিষ্টি কুমড়া',
        'radish' => 'মূলা',
        'beetroot' => 'বিট',
        'celery' => 'সেলারি',
        'green-bean' => 'শিম',
        'lettuce' => 'লেটুস',
        'sausage' => 'সসেজ',
        'ham' => 'হ্যাম',
        'duck' => 'হাঁসের মাংস',
        'crab' => 'কাঁকড়া',
        'sour-cream' => 'টক ক্রিম',
        'cream-cheese' => 'ক্রিম চিজ',
        'jam' => 'জ্যাম',
        'ketchup' => 'কেচাপ',
        'mayonnaise' => 'মেয়োনিজ',
        'orange-juice' => 'কমলার রস',
        'walnut' => 'আখরোট',
        'pistachio' => 'পেস্তা',
        'raisin' => 'কিশমিশ',
        'date' => 'খেজুর',
    ];

    public static function for(string $slug): ?string
    {
        return self::NAMES[$slug] ?? null;
    }

    /** @return array<string, string> */
    public static function all(): array
    {
        return self::NAMES;
    }
}
