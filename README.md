# ReviewAI (쇼핑 리뷰 분석 RAG 챗봇)

이 프로젝트는 인터넷 쇼핑몰의 수많은 리뷰들을 AI가 순식간에 읽고 분석하여 핵심 요약, 장단점 비교 등을 제공해 주는 지능형 RAG(Retrieval-Augmented Generation) 챗봇 애플리케이션입니다. Next.js, Pinecone, LangChain, Supabase, OpenAI API를 활용하여 구축되었습니다.

## 🚀 아키텍처 및 주요 기술 스택

- **프론트엔드/백엔드 프레임워크**: [Next.js](https://nextjs.org/) (App Router 기반)
- **UI/스타일링**: [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/) (아이콘)
- **벡터 데이터베이스 (Vector DB)**: [Pinecone](https://www.pinecone.io/) (리뷰 데이터 임베딩 및 유사도 검색 엔진)
- **RAG & LLM 오케스트레이션**: [LangChain](https://js.langchain.com/) (@langchain/openai, @langchain/pinecone, etc.)
- **관계형 데이터베이스 (RDB)**: [Supabase](https://supabase.com/) (채팅 목록 및 메시지 히스토리 영구 저장)
- **언어 모델 (LLM)**: [OpenAI](https://openai.com/) GPT 모델 (`gpt-4o-mini` 등)

## ✨ 핵심 기능

1. **AI 리뷰 분석 리포트**: 단순 문답을 넘어, 질문과 연관된 수백 개의 리뷰 문서를 검색하고 종합하여 **상품 요약**, **주요 장점/단점**, **다른 사용자의 실제 참고 리뷰**를 카드 형태로 예쁘게 제공합니다.
2. **채팅 세션 저장**: Supabase를 연동하여 사용자가 과거에 분석했던 대화형 세션 히스토리를 왼쪽 사이드바에 저장하고 원할 때 다시 불러올 수 있습니다. (DB상에 영구 저장)
3. **샘플 리뷰 자동 인덱싱**: 애플리케이션 내의 `samples/review.csv` 파일에 있는 수천 개의 더미/실제 리뷰 데이터를 클릭 한 번으로 Pinecone Vector DB에 업로드(임베딩 파이프라인) 할 수 있는 API를 탑재했습니다.

---

## 🛠️ 처음부터 끝까지 직접 재현하기 (Getting Started)

프로젝트를 로컬 환경에서 띄우기 위한 단계별 가이드입니다. 환경 변수 세팅과 데이터베이스 마이그레이션이 필수적입니다.

### 1단계: 저장소 클론 및 패키지 설치

```bash
# 저장소 클론 후 디렉토리 이동
git clone <repository_url>
cd chat

# 패키지 설치 (npm, yarn, pnpm, bun 등 선호하는 패키지 매니저 사용)
npm install
```

### 2단계: 외부 서비스 API Key 및 환경 변수 설정

프로젝트 최상단 폴더(`chat`)에 `.env` 파일을 생성하고 아래의 정보들을 각 서비스에서 발급받아 기입합니다.

```env
# 1. Pinecone 설정 (https://app.pinecone.io)
# 설정 방법: Pinecone 대시보드 -> API Keys 접속 -> `review-chatbot` 이라는 인덱스를 생성 후 키 복사
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX=review-chatbot

# 2. Supabase 설정 (https://supabase.com)
# 설정 방법: Supabase 프로젝트 생성 -> Project Settings -> API 메뉴 확인
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here 

# 3. OpenAI 설정 (https://platform.openai.com)
# 설정 방법: OpenAI API 대시보드에서 키 발급 (임베딩 및 텍스트 생성용)
OPENAI_API_KEY=sk-your_openai_api_key_here
```

### 3단계: Supabase 데이터베이스 테이블 및 RLS 적용

채팅 히스토리를 저장하려면 Supabase에 테이블과 RLS(Row Level Security) 접근 권한을 만들어야 합니다. 이 프로젝트에는 SQL 마이그레이션 파일이 포함되어 있습니다. 
Supabase 대시보드의 **SQL Editor** 창을 열고, 아래 경로에 있는 SQL 파일 내용을 순서대로 복사해서 실행(Run)해 주세요.

- `supabase/migrations/20231230000001_create_chat_tables.sql`
- `supabase/migrations/20231230000005_update_reviews_schema_to_match_csv.sql` (선택 사항 - DB에 직접 raw 리뷰를 적재할 경우)

### 4단계: Vercel에 애플리케이션 배포하기

이 프로젝트는 Next.js로 개발되었기 때문에 [Vercel](https://vercel.com/)을 통한 배포가 가장 쉽고 권장됩니다.

1. **GitHub에 리포지토리 푸시**: 앞서 클론 받은 로컬 폴더(또는 본인만의 새로운 저장소)를 본인의 GitHub 계정에 Push 합니다.
2. **Vercel 연동**: Vercel 대시보드에서 `Add New...` > `Project`를 선택하고 방금 푸시한 GitHub 리포지토리를 연결(Import)합니다.
3. **환경 변수 세팅**: Vercel 배포 설정 화면의 "Environment Variables" 섹션에 앞서 2단계에서 발급받은 `.env` 변수들(PINECONE_..., NEXT_PUBLIC_SUPABASE_..., OPENAI_API_KEY)을 똑같이 모두 복사하여 붙여넣고 `Deploy`를 클릭합니다.
4. **배포 완료**: 빌드가 완료되면 Vercel에서 제공하는 배포용 공개 도메인(예: `https://your-project.vercel.app`) 주소를 얻게 됩니다.

### 5단계: 샘플 리뷰 데이터 인덱싱 (필수)

API 연동 및 배포는 완료되었으나, AI가 답변을 하려면 지식 창고(Vector DB) 안에 데이터가 들어가 있어야 합니다.

1. 앞서 4단계에서 생성된 **Vercel 배포 주소(예: `https://your-project.vercel.app`)로 접속**합니다.
2. 왼쪽 사이드바 메뉴 하단에 있는 **[샘플 데이터 인덱싱]** 물리 버튼을 클릭합니다.
3. 시스템이 백그라운드에서 프로젝트 내의 `samples/review.csv` 데이터를 OpenAI의 임베딩 모델을 사용해 잘게 쪼갠 후 Pinecone DB로 전송합니다. (*데이터량에 따라 1~3분 정도 소요될 수 있습니다.*)
4. 화면에 "인덱싱 완료" 알림 창이 뜨면 RAG 챗봇을 사용할 완벽한 준비가 끝난 것입니다!

### 6단계: 자유롭게 질문하기

이제 모든 준비가 끝났습니다! 채팅 하단 입력창에 아래와 같은 자연스러운 문장으로 자유롭게 질문해 보세요.

- "가성비 좋은 노이즈 캔슬링 이어폰 추천해줘"
- "게이밍 헤드셋 중 마이크 품질 제일 좋은 건 뭐야?"
- "기계식 키보드 축 종류별로 타건감 꼼꼼히 비교해줘"

## 🗂️ 주요 폴더 구조 설명

- `app/` - Next.js App Router 프론트엔드 UI 컴포넌트 (`page.tsx`) 와 백엔드 API Routes (`api/`) 관리
- `lib/` - Supabase 클라이언트, Pinecone 헬퍼 유틸리티 함수 등 집약
- `supabase/migrations/` - 데이터베이스 초기 세팅을 위한 SQL 명세서
- `samples/` - 인덱싱 테스트용 CSV 리뷰 원본 더미 데이터
