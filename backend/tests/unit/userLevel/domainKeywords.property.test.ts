/**
 * Domain Keywords Non-Empty Property Test
 *
 * Feature: user-level-system, Property 2: Domain Keywords Non-Empty
 *
 * For any occupation domain in the occupation_domains table (except the "General"
 * domain with code "000"), the keywords array must contain at least one keyword
 * for matching purposes.
 *
 * **Validates: Requirements 2.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Occupation Domain interface matching the database schema
 */
interface OccupationDomain {
  majorCode: string;
  majorName: string;
  middleCode: string;
  middleName: string;
  minorCode: string;
  minorName: string;
  keywords: string[];
}

/**
 * JSCO Occupation Domains seed data
 * This data mirrors the seed migration: 20260201000001_seed_occupation_domains.sql
 * Total: 115 domains covering categories 0, A-K
 */
const OCCUPATION_DOMAINS: OccupationDomain[] = [
  // CATEGORY 0: 一般（General - for unclassified habits）
  { majorCode: '0', majorName: '一般', middleCode: '0-00', middleName: '一般', minorCode: '000', minorName: '一般（未分類）', keywords: ['general', '一般', 'その他', 'other', '未分類', 'unclassified'] },

  // CATEGORY A: 管理的職業
  { majorCode: 'A', majorName: '管理的職業', middleCode: 'A-01', middleName: '管理的公務員', minorCode: 'A-01-011', minorName: '議会議員', keywords: ['政治', '議員', '公務員', 'politics', 'politician', '国会', '地方議会'] },
  { majorCode: 'A', majorName: '管理的職業', middleCode: 'A-01', middleName: '管理的公務員', minorCode: 'A-01-012', minorName: '管理的国家公務員', keywords: ['公務員', '国家公務員', '行政', 'government', 'civil servant', '官僚'] },
  { majorCode: 'A', majorName: '管理的職業', middleCode: 'A-01', middleName: '管理的公務員', minorCode: 'A-01-013', minorName: '管理的地方公務員', keywords: ['公務員', '地方公務員', '行政', 'local government', '市役所', '県庁'] },
  { majorCode: 'A', majorName: '管理的職業', middleCode: 'A-02', middleName: '法人・団体役員', minorCode: 'A-02-021', minorName: '会社役員', keywords: ['経営', '役員', 'CEO', 'executive', 'management', '取締役', '社長', 'director'] },
  { majorCode: 'A', majorName: '管理的職業', middleCode: 'A-02', middleName: '法人・団体役員', minorCode: 'A-02-022', minorName: '団体役員', keywords: ['役員', '理事', '団体', 'organization', 'board member', 'NPO'] },
  { majorCode: 'A', majorName: '管理的職業', middleCode: 'A-03', middleName: '法人・団体管理職員', minorCode: 'A-03-031', minorName: '会社管理職員', keywords: ['管理職', 'マネージャー', 'manager', '部長', '課長', 'leadership', 'リーダーシップ'] },
  { majorCode: 'A', majorName: '管理的職業', middleCode: 'A-03', middleName: '法人・団体管理職員', minorCode: 'A-03-032', minorName: '団体管理職員', keywords: ['管理職', '事務局長', 'director', '団体運営'] },

  // CATEGORY B: 専門的・技術的職業 - B-11: 情報処理・通信技術者
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-111', minorName: 'システムエンジニア', keywords: ['プログラミング', 'SE', 'システム開発', 'software', 'engineering', 'coding', 'システム設計', 'IT'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-112', minorName: 'プログラマー', keywords: ['プログラミング', 'コーディング', 'programming', 'developer', 'coding', 'ソフトウェア', 'アプリ開発'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-113', minorName: 'ネットワークエンジニア', keywords: ['ネットワーク', 'インフラ', 'network', 'infrastructure', 'サーバー', 'クラウド', 'AWS'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-114', minorName: 'データベースエンジニア', keywords: ['データベース', 'DB', 'SQL', 'database', 'データ管理', 'DBA'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-115', minorName: 'セキュリティエンジニア', keywords: ['セキュリティ', 'security', 'サイバーセキュリティ', '情報セキュリティ', 'cybersecurity'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-116', minorName: 'データサイエンティスト', keywords: ['データ分析', 'データサイエンス', 'data science', 'machine learning', '機械学習', 'AI', '統計'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-117', minorName: 'Webデザイナー', keywords: ['Webデザイン', 'UI', 'UX', 'web design', 'フロントエンド', 'HTML', 'CSS'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-11', middleName: '情報処理・通信技術者', minorCode: 'B-11-118', minorName: 'ITコンサルタント', keywords: ['ITコンサル', 'コンサルティング', 'IT consulting', 'DX', 'デジタル変革'] },

  // B-12: 研究者
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-12', middleName: '研究者', minorCode: 'B-12-121', minorName: '自然科学系研究者', keywords: ['研究', '科学', 'research', 'science', '実験', '論文', 'scientist'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-12', middleName: '研究者', minorCode: 'B-12-122', minorName: '人文・社会科学系研究者', keywords: ['研究', '人文科学', '社会科学', 'humanities', 'social science', '論文'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-12', middleName: '研究者', minorCode: 'B-12-123', minorName: '工学系研究者', keywords: ['研究', '工学', 'engineering research', '技術開発', 'R&D'] },

  // B-13: 医師、歯科医師、獣医師、薬剤師
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-13', middleName: '医師、歯科医師、獣医師、薬剤師', minorCode: 'B-13-131', minorName: '医師', keywords: ['医療', '医師', 'doctor', 'medicine', '診療', '治療', 'physician'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-13', middleName: '医師、歯科医師、獣医師、薬剤師', minorCode: 'B-13-132', minorName: '歯科医師', keywords: ['歯科', '歯医者', 'dentist', '歯科治療', 'dental'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-13', middleName: '医師、歯科医師、獣医師、薬剤師', minorCode: 'B-13-133', minorName: '獣医師', keywords: ['獣医', '動物', 'veterinarian', 'vet', 'animal care'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-13', middleName: '医師、歯科医師、獣医師、薬剤師', minorCode: 'B-13-134', minorName: '薬剤師', keywords: ['薬剤', '薬局', 'pharmacist', 'pharmacy', '調剤'] },

  // B-14: 保健師、助産師、看護師
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-14', middleName: '保健師、助産師、看護師', minorCode: 'B-14-141', minorName: '看護師', keywords: ['看護', 'nurse', '医療', 'healthcare', '患者ケア', 'nursing'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-14', middleName: '保健師、助産師、看護師', minorCode: 'B-14-142', minorName: '保健師', keywords: ['保健', '健康指導', 'public health nurse', '予防医療', 'health promotion'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-14', middleName: '保健師、助産師、看護師', minorCode: 'B-14-143', minorName: '助産師', keywords: ['助産', '出産', 'midwife', '産科', 'childbirth'] },

  // B-15: 教員
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-15', middleName: '教員', minorCode: 'B-15-151', minorName: '大学教授', keywords: ['教育', '大学', 'professor', 'teaching', '講義', '研究', 'academic'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-15', middleName: '教員', minorCode: 'B-15-152', minorName: '高等学校教員', keywords: ['教育', '高校', 'high school teacher', '教師', '授業'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-15', middleName: '教員', minorCode: 'B-15-153', minorName: '中学校教員', keywords: ['教育', '中学', 'middle school teacher', '教師', '授業'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-15', middleName: '教員', minorCode: 'B-15-154', minorName: '小学校教員', keywords: ['教育', '小学校', 'elementary teacher', '教師', '授業'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-15', middleName: '教員', minorCode: 'B-15-155', minorName: '幼稚園教員', keywords: ['教育', '幼稚園', 'kindergarten teacher', '幼児教育', '保育'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-15', middleName: '教員', minorCode: 'B-15-156', minorName: '特別支援学校教員', keywords: ['特別支援', '教育', 'special education', '障害児教育'] },

  // B-16: 法務従事者
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-16', middleName: '法務従事者', minorCode: 'B-16-161', minorName: '弁護士', keywords: ['法律', '弁護士', 'lawyer', 'legal', '訴訟', 'attorney', '法務'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-16', middleName: '法務従事者', minorCode: 'B-16-162', minorName: '司法書士', keywords: ['司法書士', '登記', 'judicial scrivener', '法務', '不動産登記'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-16', middleName: '法務従事者', minorCode: 'B-16-163', minorName: '行政書士', keywords: ['行政書士', '許認可', 'administrative scrivener', '書類作成'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-16', middleName: '法務従事者', minorCode: 'B-16-164', minorName: '弁理士', keywords: ['弁理士', '特許', 'patent attorney', '知的財産', '商標'] },

  // B-17: 経営・金融・保険専門職業従事者
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-17', middleName: '経営・金融・保険専門職業従事者', minorCode: 'B-17-171', minorName: '公認会計士', keywords: ['会計', '監査', 'accountant', 'audit', '財務', 'CPA'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-17', middleName: '経営・金融・保険専門職業従事者', minorCode: 'B-17-172', minorName: '税理士', keywords: ['税務', '税理士', 'tax accountant', '確定申告', '節税'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-17', middleName: '経営・金融・保険専門職業従事者', minorCode: 'B-17-173', minorName: '社会保険労務士', keywords: ['社労士', '労務', 'labor consultant', '人事', '社会保険'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-17', middleName: '経営・金融・保険専門職業従事者', minorCode: 'B-17-174', minorName: '中小企業診断士', keywords: ['経営コンサル', '診断士', 'business consultant', '経営改善'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-17', middleName: '経営・金融・保険専門職業従事者', minorCode: 'B-17-175', minorName: 'ファイナンシャルプランナー', keywords: ['FP', '資産運用', 'financial planner', '投資', '保険'] },

  // B-18: 建築・土木・測量技術者
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-18', middleName: '建築・土木・測量技術者', minorCode: 'B-18-181', minorName: '建築士', keywords: ['建築', '設計', 'architect', '建物設計', '一級建築士'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-18', middleName: '建築・土木・測量技術者', minorCode: 'B-18-182', minorName: '土木技術者', keywords: ['土木', 'インフラ', 'civil engineer', '道路', '橋梁'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-18', middleName: '建築・土木・測量技術者', minorCode: 'B-18-183', minorName: '測量士', keywords: ['測量', '地図', 'surveyor', '土地測量', 'GIS'] },

  // B-19: その他の専門的職業
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-19', middleName: 'その他の専門的職業', minorCode: 'B-19-191', minorName: '通訳者', keywords: ['通訳', '翻訳', 'interpreter', '語学', '外国語', 'translation'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-19', middleName: 'その他の専門的職業', minorCode: 'B-19-192', minorName: '翻訳者', keywords: ['翻訳', '通訳', 'translator', '語学', '外国語'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-19', middleName: 'その他の専門的職業', minorCode: 'B-19-193', minorName: 'カウンセラー', keywords: ['カウンセリング', '心理', 'counselor', 'メンタルヘルス', '相談'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-19', middleName: 'その他の専門的職業', minorCode: 'B-19-194', minorName: '栄養士', keywords: ['栄養', '食事', 'nutritionist', 'dietitian', '健康管理'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-19', middleName: 'その他の専門的職業', minorCode: 'B-19-195', minorName: '理学療法士', keywords: ['リハビリ', '理学療法', 'physical therapist', 'PT', '運動療法'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-19', middleName: 'その他の専門的職業', minorCode: 'B-19-196', minorName: '作業療法士', keywords: ['作業療法', 'リハビリ', 'occupational therapist', 'OT', '日常生活訓練'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-19', middleName: 'その他の専門的職業', minorCode: 'B-19-197', minorName: '臨床心理士', keywords: ['心理', 'カウンセリング', 'clinical psychologist', 'メンタルヘルス', '心理療法'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-19', middleName: 'その他の専門的職業', minorCode: 'B-19-198', minorName: 'デザイナー', keywords: ['デザイン', 'グラフィック', 'designer', 'クリエイティブ', 'アート'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-19', middleName: 'その他の専門的職業', minorCode: 'B-19-199', minorName: '写真家', keywords: ['写真', 'カメラ', 'photographer', '撮影', 'フォトグラファー'] },

  // CATEGORY C: 事務的職業
  { majorCode: 'C', majorName: '事務的職業', middleCode: 'C-21', middleName: '一般事務従事者', minorCode: 'C-21-211', minorName: '一般事務員', keywords: ['事務', 'office', 'administration', '書類', 'デスクワーク', 'オフィスワーク'] },
  { majorCode: 'C', majorName: '事務的職業', middleCode: 'C-21', middleName: '一般事務従事者', minorCode: 'C-21-212', minorName: '総務事務員', keywords: ['総務', '人事', 'general affairs', '社内管理', '庶務'] },
  { majorCode: 'C', majorName: '事務的職業', middleCode: 'C-21', middleName: '一般事務従事者', minorCode: 'C-21-213', minorName: '人事事務員', keywords: ['人事', '採用', 'HR', 'human resources', '労務管理'] },
  { majorCode: 'C', majorName: '事務的職業', middleCode: 'C-22', middleName: '会計事務従事者', minorCode: 'C-22-221', minorName: '経理事務員', keywords: ['経理', '会計', 'accounting', '簿記', '財務', '決算'] },
  { majorCode: 'C', majorName: '事務的職業', middleCode: 'C-22', middleName: '会計事務従事者', minorCode: 'C-22-222', minorName: '出納事務員', keywords: ['出納', '現金管理', 'cashier', '金銭管理'] },
  { majorCode: 'C', majorName: '事務的職業', middleCode: 'C-23', middleName: '生産関連事務従事者', minorCode: 'C-23-231', minorName: '生産管理事務員', keywords: ['生産管理', '製造', 'production control', '在庫管理', '工程管理'] },
  { majorCode: 'C', majorName: '事務的職業', middleCode: 'C-24', middleName: '営業・販売事務従事者', minorCode: 'C-24-241', minorName: '営業事務員', keywords: ['営業事務', '受発注', 'sales administration', '顧客対応'] },
  { majorCode: 'C', majorName: '事務的職業', middleCode: 'C-25', middleName: '外勤事務従事者', minorCode: 'C-25-251', minorName: '集金人', keywords: ['集金', '外勤', 'collection', '訪問'] },
  { majorCode: 'C', majorName: '事務的職業', middleCode: 'C-26', middleName: '運輸・郵便事務従事者', minorCode: 'C-26-261', minorName: '運行管理事務員', keywords: ['運行管理', '物流', 'logistics', '配送管理'] },
  { majorCode: 'C', majorName: '事務的職業', middleCode: 'C-27', middleName: '事務用機器操作員', minorCode: 'C-27-271', minorName: 'データ入力オペレーター', keywords: ['データ入力', 'タイピング', 'data entry', 'キーパンチャー'] },

  // CATEGORY D: 販売の職業
  { majorCode: 'D', majorName: '販売の職業', middleCode: 'D-31', middleName: '商品販売従事者', minorCode: 'D-31-311', minorName: '小売店販売員', keywords: ['販売', '接客', 'sales', 'retail', '店舗', 'ショップ'] },
  { majorCode: 'D', majorName: '販売の職業', middleCode: 'D-31', middleName: '商品販売従事者', minorCode: 'D-31-312', minorName: '卸売販売員', keywords: ['卸売', '営業', 'wholesale', 'B2B', '法人営業'] },
  { majorCode: 'D', majorName: '販売の職業', middleCode: 'D-31', middleName: '商品販売従事者', minorCode: 'D-31-313', minorName: 'レジ係', keywords: ['レジ', '会計', 'cashier', 'POS', '精算'] },
  { majorCode: 'D', majorName: '販売の職業', middleCode: 'D-32', middleName: '販売類似職業従事者', minorCode: 'D-32-321', minorName: '不動産仲介人', keywords: ['不動産', '仲介', 'real estate', '物件', '賃貸'] },
  { majorCode: 'D', majorName: '販売の職業', middleCode: 'D-32', middleName: '販売類似職業従事者', minorCode: 'D-32-322', minorName: '保険外交員', keywords: ['保険', '営業', 'insurance sales', '生命保険', '損害保険'] },
  { majorCode: 'D', majorName: '販売の職業', middleCode: 'D-33', middleName: '営業職業従事者', minorCode: 'D-33-331', minorName: '法人営業', keywords: ['法人営業', 'B2B', 'corporate sales', '企業向け営業'] },
  { majorCode: 'D', majorName: '販売の職業', middleCode: 'D-33', middleName: '営業職業従事者', minorCode: 'D-33-332', minorName: '個人営業', keywords: ['個人営業', 'B2C', 'consumer sales', '顧客開拓'] },
  { majorCode: 'D', majorName: '販売の職業', middleCode: 'D-33', middleName: '営業職業従事者', minorCode: 'D-33-333', minorName: 'ルート営業', keywords: ['ルート営業', '既存顧客', 'route sales', '定期訪問'] },

  // CATEGORY E: サービスの職業
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-41', middleName: '介護サービス職業従事者', minorCode: 'E-41-411', minorName: '介護職員', keywords: ['介護', 'care', '福祉', 'welfare', '高齢者', 'ケアワーカー'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-41', middleName: '介護サービス職業従事者', minorCode: 'E-41-412', minorName: 'ホームヘルパー', keywords: ['訪問介護', 'ヘルパー', 'home care', '在宅介護'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-42', middleName: '保健医療サービス職業従事者', minorCode: 'E-42-421', minorName: '歯科助手', keywords: ['歯科', 'アシスタント', 'dental assistant', '歯科補助'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-43', middleName: '生活衛生サービス職業従事者', minorCode: 'E-43-431', minorName: '理容師', keywords: ['理容', '散髪', 'barber', 'ヘアカット'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-43', middleName: '生活衛生サービス職業従事者', minorCode: 'E-43-432', minorName: '美容師', keywords: ['美容', 'ヘアスタイリスト', 'hairdresser', 'beautician', 'サロン'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-43', middleName: '生活衛生サービス職業従事者', minorCode: 'E-43-433', minorName: 'エステティシャン', keywords: ['エステ', '美容', 'esthetician', 'スキンケア', 'beauty'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-44', middleName: '飲食物調理従事者', minorCode: 'E-44-441', minorName: '調理師', keywords: ['料理', '調理', 'cooking', 'chef', '食事', 'シェフ'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-44', middleName: '飲食物調理従事者', minorCode: 'E-44-442', minorName: 'パティシエ', keywords: ['菓子', 'ケーキ', 'pastry chef', 'スイーツ', 'デザート'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-44', middleName: '飲食物調理従事者', minorCode: 'E-44-443', minorName: 'バリスタ', keywords: ['コーヒー', 'カフェ', 'barista', 'coffee', 'ドリンク'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-45', middleName: '飲食物給仕従事者', minorCode: 'E-45-451', minorName: 'ウェイター・ウェイトレス', keywords: ['接客', 'サービス', 'waiter', 'waitress', 'ホール'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-46', middleName: '居住施設・ビル等管理人', minorCode: 'E-46-461', minorName: 'マンション管理人', keywords: ['管理人', 'マンション', 'building manager', '施設管理'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-47', middleName: 'その他のサービス職業従事者', minorCode: 'E-47-471', minorName: 'ツアーガイド', keywords: ['ガイド', '観光', 'tour guide', '旅行', 'ツアー'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-47', middleName: 'その他のサービス職業従事者', minorCode: 'E-47-472', minorName: 'フィットネスインストラクター', keywords: ['フィットネス', 'トレーナー', 'fitness instructor', 'ジム', '運動'] },
  { majorCode: 'E', majorName: 'サービスの職業', middleCode: 'E-47', middleName: 'その他のサービス職業従事者', minorCode: 'E-47-473', minorName: 'ヨガインストラクター', keywords: ['ヨガ', 'yoga', 'instructor', 'ウェルネス', 'wellness'] },

  // CATEGORY F: 保安の職業
  { majorCode: 'F', majorName: '保安の職業', middleCode: 'F-51', middleName: '自衛官', minorCode: 'F-51-511', minorName: '自衛官', keywords: ['自衛隊', '防衛', 'military', 'defense', '国防'] },
  { majorCode: 'F', majorName: '保安の職業', middleCode: 'F-52', middleName: '警察官', minorCode: 'F-52-521', minorName: '警察官', keywords: ['警察', '治安', 'police', 'law enforcement', '犯罪捜査'] },
  { majorCode: 'F', majorName: '保安の職業', middleCode: 'F-53', middleName: '消防員', minorCode: 'F-53-531', minorName: '消防士', keywords: ['消防', '救急', 'firefighter', '防災', '救助'] },
  { majorCode: 'F', majorName: '保安の職業', middleCode: 'F-54', middleName: '警備員', minorCode: 'F-54-541', minorName: '施設警備員', keywords: ['警備', 'セキュリティ', 'security guard', '施設管理'] },
  { majorCode: 'F', majorName: '保安の職業', middleCode: 'F-54', middleName: '警備員', minorCode: 'F-54-542', minorName: '交通誘導員', keywords: ['交通誘導', '警備', 'traffic control', '道路工事'] },

  // CATEGORY G: 農林漁業の職業
  { majorCode: 'G', majorName: '農林漁業の職業', middleCode: 'G-61', middleName: '農業従事者', minorCode: 'G-61-611', minorName: '農耕作業者', keywords: ['農業', '農作物', 'farming', 'agriculture', '栽培', '畑'] },
  { majorCode: 'G', majorName: '農林漁業の職業', middleCode: 'G-61', middleName: '農業従事者', minorCode: 'G-61-612', minorName: '果樹栽培者', keywords: ['果樹', '果物', 'fruit farming', 'orchard', 'りんご', 'みかん'] },
  { majorCode: 'G', majorName: '農林漁業の職業', middleCode: 'G-61', middleName: '農業従事者', minorCode: 'G-61-613', minorName: '野菜栽培者', keywords: ['野菜', '栽培', 'vegetable farming', '有機野菜', '家庭菜園'] },
  { majorCode: 'G', majorName: '農林漁業の職業', middleCode: 'G-61', middleName: '農業従事者', minorCode: 'G-61-614', minorName: '稲作農業者', keywords: ['稲作', '米', 'rice farming', '田んぼ', '水田'] },
  { majorCode: 'G', majorName: '農林漁業の職業', middleCode: 'G-62', middleName: '畜産従事者', minorCode: 'G-62-621', minorName: '酪農家', keywords: ['酪農', '牛乳', 'dairy farming', '乳牛', '牧場'] },
  { majorCode: 'G', majorName: '農林漁業の職業', middleCode: 'G-62', middleName: '畜産従事者', minorCode: 'G-62-622', minorName: '養豚業者', keywords: ['養豚', '豚', 'pig farming', '畜産'] },
  { majorCode: 'G', majorName: '農林漁業の職業', middleCode: 'G-62', middleName: '畜産従事者', minorCode: 'G-62-623', minorName: '養鶏業者', keywords: ['養鶏', '鶏', 'poultry farming', '卵', '鶏肉'] },
  { majorCode: 'G', majorName: '農林漁業の職業', middleCode: 'G-63', middleName: '林業従事者', minorCode: 'G-63-631', minorName: '林業作業者', keywords: ['林業', '森林', 'forestry', '木材', '伐採'] },
  { majorCode: 'G', majorName: '農林漁業の職業', middleCode: 'G-64', middleName: '漁業従事者', minorCode: 'G-64-641', minorName: '漁師', keywords: ['漁業', '魚', 'fishing', '漁船', '水産'] },
  { majorCode: 'G', majorName: '農林漁業の職業', middleCode: 'G-64', middleName: '漁業従事者', minorCode: 'G-64-642', minorName: '養殖業者', keywords: ['養殖', '水産', 'aquaculture', '魚介類', '海産物'] },

  // CATEGORY H: 生産工程の職業
  { majorCode: 'H', majorName: '生産工程の職業', middleCode: 'H-71', middleName: '製造・加工処理従事者', minorCode: 'H-71-711', minorName: '金属加工作業者', keywords: ['製造', '加工', 'manufacturing', '工場', 'production', '金属'] },
  { majorCode: 'H', majorName: '生産工程の職業', middleCode: 'H-71', middleName: '製造・加工処理従事者', minorCode: 'H-71-712', minorName: '機械組立工', keywords: ['組立', '機械', 'assembly', '製造', '工場'] },
  { majorCode: 'H', majorName: '生産工程の職業', middleCode: 'H-71', middleName: '製造・加工処理従事者', minorCode: 'H-71-713', minorName: '電子機器組立工', keywords: ['電子機器', '組立', 'electronics assembly', '半導体', '基板'] },
  { majorCode: 'H', majorName: '生産工程の職業', middleCode: 'H-71', middleName: '製造・加工処理従事者', minorCode: 'H-71-714', minorName: '食品加工作業者', keywords: ['食品加工', '製造', 'food processing', '食品工場'] },
  { majorCode: 'H', majorName: '生産工程の職業', middleCode: 'H-71', middleName: '製造・加工処理従事者', minorCode: 'H-71-715', minorName: '縫製作業者', keywords: ['縫製', '裁縫', 'sewing', 'アパレル', '衣料'] },
  { majorCode: 'H', majorName: '生産工程の職業', middleCode: 'H-72', middleName: '機械整備・修理従事者', minorCode: 'H-72-721', minorName: '自動車整備士', keywords: ['自動車', '整備', 'auto mechanic', '車検', '修理'] },
  { majorCode: 'H', majorName: '生産工程の職業', middleCode: 'H-72', middleName: '機械整備・修理従事者', minorCode: 'H-72-722', minorName: '産業機械整備工', keywords: ['機械整備', 'メンテナンス', 'machine maintenance', '設備保全'] },
  { majorCode: 'H', majorName: '生産工程の職業', middleCode: 'H-73', middleName: '製品検査従事者', minorCode: 'H-73-731', minorName: '品質検査員', keywords: ['品質管理', '検査', 'quality control', 'QC', '品質保証'] },
  { majorCode: 'H', majorName: '生産工程の職業', middleCode: 'H-74', middleName: '機械検査従事者', minorCode: 'H-74-741', minorName: '機械検査員', keywords: ['機械検査', '点検', 'machine inspection', '設備点検'] },

  // CATEGORY I: 輸送・機械運転の職業
  { majorCode: 'I', majorName: '輸送・機械運転の職業', middleCode: 'I-81', middleName: '鉄道運転従事者', minorCode: 'I-81-811', minorName: '電車運転士', keywords: ['運転', '鉄道', 'train', 'driver', '運輸', '電車'] },
  { majorCode: 'I', majorName: '輸送・機械運転の職業', middleCode: 'I-82', middleName: '自動車運転従事者', minorCode: 'I-82-821', minorName: 'バス運転手', keywords: ['バス', '運転', 'bus driver', '旅客輸送'] },
  { majorCode: 'I', majorName: '輸送・機械運転の職業', middleCode: 'I-82', middleName: '自動車運転従事者', minorCode: 'I-82-822', minorName: 'タクシー運転手', keywords: ['タクシー', '運転', 'taxi driver', '旅客輸送'] },
  { majorCode: 'I', majorName: '輸送・機械運転の職業', middleCode: 'I-82', middleName: '自動車運転従事者', minorCode: 'I-82-823', minorName: 'トラック運転手', keywords: ['トラック', '運転', 'truck driver', '物流', '配送'] },
  { majorCode: 'I', majorName: '輸送・機械運転の職業', middleCode: 'I-83', middleName: '船舶・航空機運転従事者', minorCode: 'I-83-831', minorName: '船長・航海士', keywords: ['船舶', '航海', 'ship captain', '海運', '船員'] },
  { majorCode: 'I', majorName: '輸送・機械運転の職業', middleCode: 'I-83', middleName: '船舶・航空機運転従事者', minorCode: 'I-83-832', minorName: 'パイロット', keywords: ['パイロット', '航空', 'pilot', '飛行機', '航空機'] },
  { majorCode: 'I', majorName: '輸送・機械運転の職業', middleCode: 'I-84', middleName: 'その他の輸送従事者', minorCode: 'I-84-841', minorName: 'フォークリフト運転者', keywords: ['フォークリフト', '倉庫', 'forklift operator', '物流'] },
  { majorCode: 'I', majorName: '輸送・機械運転の職業', middleCode: 'I-84', middleName: 'その他の輸送従事者', minorCode: 'I-84-842', minorName: 'クレーン運転者', keywords: ['クレーン', '重機', 'crane operator', '建設現場'] },

  // CATEGORY J: 建設・採掘の職業
  { majorCode: 'J', majorName: '建設・採掘の職業', middleCode: 'J-91', middleName: '建設躯体工事従事者', minorCode: 'J-91-911', minorName: '型枠大工', keywords: ['建設', '建築', 'construction', '工事', '大工', '型枠'] },
  { majorCode: 'J', majorName: '建設・採掘の職業', middleCode: 'J-91', middleName: '建設躯体工事従事者', minorCode: 'J-91-912', minorName: '鉄筋工', keywords: ['鉄筋', '建設', 'rebar worker', '建築工事'] },
  { majorCode: 'J', majorName: '建設・採掘の職業', middleCode: 'J-91', middleName: '建設躯体工事従事者', minorCode: 'J-91-913', minorName: 'とび職', keywords: ['とび', '足場', 'scaffolding', '高所作業'] },
  { majorCode: 'J', majorName: '建設・採掘の職業', middleCode: 'J-92', middleName: '建設従事者', minorCode: 'J-92-921', minorName: '大工', keywords: ['大工', '木工', 'carpenter', '建築', '木造'] },
  { majorCode: 'J', majorName: '建設・採掘の職業', middleCode: 'J-92', middleName: '建設従事者', minorCode: 'J-92-922', minorName: '左官', keywords: ['左官', '塗り壁', 'plasterer', '壁塗り'] },
  { majorCode: 'J', majorName: '建設・採掘の職業', middleCode: 'J-92', middleName: '建設従事者', minorCode: 'J-92-923', minorName: '屋根職人', keywords: ['屋根', '瓦', 'roofer', '屋根工事'] },
  { majorCode: 'J', majorName: '建設・採掘の職業', middleCode: 'J-93', middleName: '電気工事従事者', minorCode: 'J-93-931', minorName: '電気工事士', keywords: ['電気工事', '配線', 'electrician', '電気設備'] },
  { majorCode: 'J', majorName: '建設・採掘の職業', middleCode: 'J-94', middleName: '土木作業従事者', minorCode: 'J-94-941', minorName: '土木作業員', keywords: ['土木', '道路工事', 'civil construction', 'インフラ'] },
  { majorCode: 'J', majorName: '建設・採掘の職業', middleCode: 'J-95', middleName: '採掘従事者', minorCode: 'J-95-951', minorName: '鉱山作業員', keywords: ['採掘', '鉱山', 'mining', '鉱業'] },

  // CATEGORY K: 運搬・清掃・包装等の職業
  { majorCode: 'K', majorName: '運搬・清掃・包装等の職業', middleCode: 'K-99', middleName: '運搬従事者', minorCode: 'K-99-991', minorName: '倉庫作業者', keywords: ['運搬', '倉庫', 'warehouse', 'logistics', '物流', 'ピッキング'] },
  { majorCode: 'K', majorName: '運搬・清掃・包装等の職業', middleCode: 'K-99', middleName: '運搬従事者', minorCode: 'K-99-992', minorName: '配送員', keywords: ['配送', '宅配', 'delivery', '運送', 'デリバリー'] },
  { majorCode: 'K', majorName: '運搬・清掃・包装等の職業', middleCode: 'K-99', middleName: '運搬従事者', minorCode: 'K-99-993', minorName: '引越作業員', keywords: ['引越', '運搬', 'moving', '荷物運搬'] },
  { majorCode: 'K', majorName: '運搬・清掃・包装等の職業', middleCode: 'K-98', middleName: '清掃従事者', minorCode: 'K-98-981', minorName: 'ビル清掃員', keywords: ['清掃', 'クリーニング', 'cleaning', 'ビルメンテナンス'] },
  { majorCode: 'K', majorName: '運搬・清掃・包装等の職業', middleCode: 'K-98', middleName: '清掃従事者', minorCode: 'K-98-982', minorName: 'ハウスクリーニング', keywords: ['清掃', '家事代行', 'house cleaning', '掃除'] },
  { majorCode: 'K', majorName: '運搬・清掃・包装等の職業', middleCode: 'K-97', middleName: '包装従事者', minorCode: 'K-97-971', minorName: '包装作業員', keywords: ['包装', '梱包', 'packaging', '出荷作業'] },

  // ADDITIONAL DOMAINS: クリエイティブ・メディア関連（B-20）
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-20', middleName: 'クリエイティブ職', minorCode: 'B-20-201', minorName: '映像クリエイター', keywords: ['映像', '動画', 'video creator', 'YouTube', '映像制作', 'filmmaker'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-20', middleName: 'クリエイティブ職', minorCode: 'B-20-202', minorName: '音楽家', keywords: ['音楽', '作曲', 'musician', 'composer', '演奏', 'music'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-20', middleName: 'クリエイティブ職', minorCode: 'B-20-203', minorName: '作家・ライター', keywords: ['執筆', 'ライティング', 'writer', 'author', '文章', 'ブログ'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-20', middleName: 'クリエイティブ職', minorCode: 'B-20-204', minorName: '編集者', keywords: ['編集', '出版', 'editor', '校正', 'メディア'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-20', middleName: 'クリエイティブ職', minorCode: 'B-20-205', minorName: 'イラストレーター', keywords: ['イラスト', '絵', 'illustrator', 'アート', 'drawing'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-20', middleName: 'クリエイティブ職', minorCode: 'B-20-206', minorName: 'アニメーター', keywords: ['アニメ', 'アニメーション', 'animator', 'animation', '作画'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-20', middleName: 'クリエイティブ職', minorCode: 'B-20-207', minorName: 'ゲームクリエイター', keywords: ['ゲーム', 'ゲーム開発', 'game developer', 'ゲームデザイン', 'Unity'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-20', middleName: 'クリエイティブ職', minorCode: 'B-20-208', minorName: '3DCGデザイナー', keywords: ['3DCG', 'CG', '3D designer', 'モデリング', 'Blender'] },

  // マーケティング・広報関連（B-21）
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-21', middleName: 'マーケティング職', minorCode: 'B-21-211', minorName: 'マーケター', keywords: ['マーケティング', '広告', 'marketing', 'advertising', 'プロモーション'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-21', middleName: 'マーケティング職', minorCode: 'B-21-212', minorName: 'デジタルマーケター', keywords: ['デジタルマーケティング', 'SNS', 'digital marketing', 'SEO', 'SEM'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-21', middleName: 'マーケティング職', minorCode: 'B-21-213', minorName: '広報担当者', keywords: ['広報', 'PR', 'public relations', 'プレスリリース', 'メディア対応'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-21', middleName: 'マーケティング職', minorCode: 'B-21-214', minorName: 'コンテンツマーケター', keywords: ['コンテンツ', 'オウンドメディア', 'content marketing', 'ブログ運営'] },

  // 教育・トレーニング関連（B-22）
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-22', middleName: '教育・研修職', minorCode: 'B-22-221', minorName: '企業研修講師', keywords: ['研修', 'トレーニング', 'corporate trainer', '社員教育', '講師'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-22', middleName: '教育・研修職', minorCode: 'B-22-222', minorName: '塾講師', keywords: ['塾', '学習塾', 'cram school teacher', '受験', '教育'] },
  { majorCode: 'B', majorName: '専門的・技術的職業', middleCode: 'B-22', middleName: '教育・研修職', minorCode: 'B-22-223', minorName: 'オンライン講師', keywords: ['オンライン教育', 'eラーニング', 'online instructor', 'Udemy', '動画講座'] },

  // 起業・スタートアップ関連（A-04）
  { majorCode: 'A', majorName: '管理的職業', middleCode: 'A-04', middleName: '起業家', minorCode: 'A-04-041', minorName: 'スタートアップ創業者', keywords: ['起業', 'スタートアップ', 'entrepreneur', 'startup', '創業', 'ベンチャー'] },
  { majorCode: 'A', majorName: '管理的職業', middleCode: 'A-04', middleName: '起業家', minorCode: 'A-04-042', minorName: 'フリーランス', keywords: ['フリーランス', '個人事業主', 'freelancer', '独立', '自営業'] },
];


// General domain code constant
const GENERAL_DOMAIN_CODE = '000';

// Get all non-General domains for testing
const NON_GENERAL_DOMAINS = OCCUPATION_DOMAINS.filter(
  (domain) => domain.minorCode !== GENERAL_DOMAIN_CODE
);

describe('Feature: user-level-system, Property 2: Domain Keywords Non-Empty', () => {
  /**
   * Property 2: Domain Keywords Non-Empty
   *
   * For any occupation domain in the occupation_domains table (except the "General"
   * domain with code "000"), the keywords array must contain at least one keyword
   * for matching purposes.
   *
   * **Validates: Requirements 2.3**
   */
  describe('Non-General domains must have at least one keyword', () => {
    it('should have at least one keyword for all non-General domains', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...NON_GENERAL_DOMAINS),
          (domain: OccupationDomain) => {
            // Property: keywords array must have at least one element
            expect(domain.keywords.length).toBeGreaterThanOrEqual(1);
            return domain.keywords.length >= 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have non-empty string keywords for all non-General domains', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...NON_GENERAL_DOMAINS),
          (domain: OccupationDomain) => {
            // Property: all keywords must be non-empty strings
            for (const keyword of domain.keywords) {
              expect(typeof keyword).toBe('string');
              expect(keyword.length).toBeGreaterThan(0);
              expect(keyword.trim()).toBe(keyword); // No leading/trailing whitespace
            }
            return domain.keywords.every(
              (k) => typeof k === 'string' && k.length > 0 && k.trim() === k
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional validation: General domain is allowed to have keywords
   * but is excluded from the non-empty requirement
   */
  describe('General domain (000) special case', () => {
    it('should have the General domain with code "000"', () => {
      const generalDomain = OCCUPATION_DOMAINS.find(
        (d) => d.minorCode === GENERAL_DOMAIN_CODE
      );
      expect(generalDomain).toBeDefined();
      expect(generalDomain?.minorName).toBe('一般（未分類）');
    });

    it('should have exactly one General domain', () => {
      const generalDomains = OCCUPATION_DOMAINS.filter(
        (d) => d.minorCode === GENERAL_DOMAIN_CODE
      );
      expect(generalDomains.length).toBe(1);
    });
  });

  /**
   * Verify domain data integrity
   */
  describe('Domain data integrity', () => {
    it('should have at least 100 non-General domains (Requirements 2.1)', () => {
      expect(NON_GENERAL_DOMAINS.length).toBeGreaterThanOrEqual(100);
    });

    it('should cover all major categories A-K (Requirements 2.2)', () => {
      const majorCategories = new Set(
        NON_GENERAL_DOMAINS.map((d) => d.majorCode)
      );
      const expectedCategories = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
      
      for (const category of expectedCategories) {
        expect(majorCategories.has(category)).toBe(true);
      }
    });

    it('should have unique minor codes for all domains', () => {
      const minorCodes = OCCUPATION_DOMAINS.map((d) => d.minorCode);
      const uniqueMinorCodes = new Set(minorCodes);
      expect(uniqueMinorCodes.size).toBe(minorCodes.length);
    });

    it('should have valid domain structure for all domains', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...OCCUPATION_DOMAINS),
          (domain: OccupationDomain) => {
            // Validate required fields exist and are non-empty
            expect(domain.majorCode).toBeDefined();
            expect(domain.majorCode.length).toBeGreaterThan(0);
            expect(domain.majorName).toBeDefined();
            expect(domain.majorName.length).toBeGreaterThan(0);
            expect(domain.middleCode).toBeDefined();
            expect(domain.middleCode.length).toBeGreaterThan(0);
            expect(domain.middleName).toBeDefined();
            expect(domain.middleName.length).toBeGreaterThan(0);
            expect(domain.minorCode).toBeDefined();
            expect(domain.minorCode.length).toBeGreaterThan(0);
            expect(domain.minorName).toBeDefined();
            expect(domain.minorName.length).toBeGreaterThan(0);
            expect(Array.isArray(domain.keywords)).toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Keyword quality checks
   */
  describe('Keyword quality', () => {
    it('should have both Japanese and English keywords for most domains', () => {
      // Check that at least 80% of domains have both Japanese and English keywords
      const domainsWithBothLanguages = NON_GENERAL_DOMAINS.filter((domain) => {
        const hasJapanese = domain.keywords.some((k) => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(k));
        const hasEnglish = domain.keywords.some((k) => /^[a-zA-Z\s]+$/.test(k));
        return hasJapanese && hasEnglish;
      });
      
      const percentage = domainsWithBothLanguages.length / NON_GENERAL_DOMAINS.length;
      expect(percentage).toBeGreaterThanOrEqual(0.8);
    });

    it('should have at least 3 keywords for most domains', () => {
      // Check that at least 90% of domains have 3+ keywords
      const domainsWithEnoughKeywords = NON_GENERAL_DOMAINS.filter(
        (domain) => domain.keywords.length >= 3
      );
      
      const percentage = domainsWithEnoughKeywords.length / NON_GENERAL_DOMAINS.length;
      expect(percentage).toBeGreaterThanOrEqual(0.9);
    });
  });
});
