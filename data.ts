
import { Product, User } from './types';

// Categories: Jackets, Lipsticks, Shirts, Shoes, Sunglasses
export const CATEGORY_NAMES = ['Jackets', 'Lipsticks', 'Shirts', 'Shoes', 'Sunglasses'];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'jk-1',
    name: "Cyber-Tech Bomber Jacket",
    category: "Jackets",
    price: 3499,
    image: "https://images.unsplash.com/photo-1551028711-031cda281d1a?auto=format&fit=crop&q=80&w=600",
    description: "2026 Edition tech-wear with thermal insulation and moisture-wicking tech.",
    rating: 4.8,
    popularityScore: 0.95
  },
  {
    id: 'lp-1',
    name: "Infinity Matte Lipstick (Crimson)",
    category: "Lipsticks",
    price: 1250,
    image: "https://images.unsplash.com/photo-1586776977607-310e9c725c37?auto=format&fit=crop&q=80&w=600",
    description: "AR-Ready matte finish for all-day wear without smudge.",
    rating: 4.9,
    popularityScore: 0.98
  },
  {
    id: 'sh-1',
    name: "Classic Silk Oxford Shirt",
    category: "Shirts",
    price: 1899,
    image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=600",
    description: "Premium cotton-silk blend, precision tailored for 2026 professionals.",
    rating: 4.5,
    popularityScore: 0.75
  },
  {
    id: 'so-1',
    name: "Vortex Gravity Running Shoes",
    category: "Shoes",
    price: 5999,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600",
    description: "Energy-return soles with adaptive fit technology for ultimate speed.",
    rating: 4.7,
    popularityScore: 0.89
  },
  {
    id: 'sg-1',
    name: "Mirrored Titanium Navigators",
    category: "Sunglasses",
    price: 2499,
    image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&q=80&w=600",
    description: "Polarized UV-Ray blocking with lightweight titanium aero-frame.",
    rating: 4.6,
    popularityScore: 0.82
  },
  {
    id: 'jk-2',
    name: "Maverick Denim Street Vest",
    category: "Jackets",
    price: 2199,
    image: "https://images.unsplash.com/photo-1576905355162-723d77bd343d?auto=format&fit=crop&q=80&w=600",
    description: "Distressed denim perfect for 2026 streetwear layering.",
    rating: 4.4,
    popularityScore: 0.88
  },
  {
    id: 'sh-2',
    name: "Tropical Breeze Linen Shirt",
    category: "Shirts",
    price: 1499,
    image: "https://images.unsplash.com/photo-1598033129183-c4f50c7176c8?auto=format&fit=crop&q=80&w=600",
    description: "Ultra-breathable linen, ideal for summer 2026 vacations.",
    rating: 4.3,
    popularityScore: 0.72
  }
];

export const MOCK_USERS: User[] = [
  { id: 'admin_1', username: 'admin', role: 'admin', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin' },
  { id: 'user_1', username: 'guest', role: 'user', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest' }
];
