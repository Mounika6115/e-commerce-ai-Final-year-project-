
export type Occasion = 'Wedding' | 'Party' | 'Office' | 'Festival' | 'Casual';
export type Gender = 'Male' | 'Female' | 'Unisex';
export type Category = 'Jackets' | 'Lipsticks' | 'Shirts' | 'Shoes' | 'Sunglasses' | string;
export type Role = 'admin' | 'user';

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  image: string;
  description: string;
  rating: number;
  popularityScore: number;
  stock?: number;
  subcategory?: string;
}

export interface CategoryItem {
  name: string;
  code: string;
  logoUrl: string;
  subcategories: string[];
}

export interface User {
  id: string;
  name: string;
  username: string;
  email?: string;
  role: Role;
  avatar: string;
  skinTone?: string;
  profileImageCode?: string;
}

export interface FriendRequest {
  id: string;
  fromId: string;
  fromName: string;
  fromAvatar: string;
  status: 'pending' | 'accepted' | 'declined';
  timestamp: string;
  mirrorTo?: string;
}

export interface SocialMessage {
  id: string;
  senderId: string;
  type: 'text' | 'product';
  text: string;
  product?: Product | null;
  timestamp: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  address: string;
  date: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  username: string;
  name: string;
  avatar: string;
  rating: number;          // 1–5
  text: string;
  date: string;
  isFake?: boolean;        // Flag for fake review detection
  // Blockchain integrity fields (populated by backend)
  blockHash?: string | null;
  blockIndex?: number | null;
  chainVerified?: boolean;
  dataHash?: string | null;
}
