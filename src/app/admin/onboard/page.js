// /src/app/admin/onboard/page.js

"use client";

import { useState } from 'react';

export default function AdminOnboardPage() {
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [tempCode, setTempCode] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // 🔑 [수정] 폼 제출 함수 바깥에서 정규화된 값을 계산하여 disabled 속성에서 사용 가능하도록 함
    const normalizedPhone = phone.replace(/[^0-9]/g, '');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setTempCode(null);
        setSuccessMessage(null);
        setLoading(true);

        // 1. 입력값 검증 (normalizedPhone은 이미 위에서 계산됨)
        if (normalizedPhone.length < 10) {
            setError("유효한 핸드폰 번호(10자리 이상)를 입력해주세요.");
            setLoading(false);
            return;
        }

        try {
            // 2. 운영진 API 호출
            const res = await fetch('/api/admin/onboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // name은 선택 사항
                body: JSON.stringify({ phone: normalizedPhone, name }),
            });

            const json = await res.json();

            if (res.status === 403) {
                 throw new Error("권한 없음: 이 기능을 사용할 운영진 권한이 없습니다.");
            }
            
            if (!json.ok) {
                // API에서 정의된 오류 메시지 사용
                throw new Error(json.error || "계정 생성 및 코드 발급에 실패했습니다.");
            }

            // 3. 성공 처리: 코드 표시
            setTempCode(json.code);
            setSuccessMessage(`✅ ${name || '고객'} 계정 처리 완료. 유효기간: ${json.expires_at ? new Date(json.expires_at).toLocaleTimeString() : '10분 이내'}`);

        } catch (e) {
            console.error(e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-lg mx-auto p-6 space-y-6 bg-white shadow-xl rounded-xl">
            <h1 className="text-3xl font-bold text-gray-800">운영진: 고객 수동 가입</h1>
            <p className="text-sm text-gray-500">
                문자 인증이 어려운 고객의 계정을 생성하고, 임시 코드를 발급합니다.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">고객 핸드폰 번호</label>
                    <input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="01012345678"
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading}
                    />
                </div>
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">고객 이름 (선택)</label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="홍길동"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        disabled={loading}
                    />
                </div>
                
                <button
                    type="submit"
                    // 🔑 [수정 반영] normalizedPhone이 밖에서 정의되었으므로 여기서 사용 가능
                    disabled={loading || normalizedPhone.length < 10}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                    {loading ? '처리 중...' : '계정 생성 및 코드 발급'}
                </button>
            </form>

            {/* 결과 표시 섹션 */}
            {error && (
                <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                    오류: {error}
                </div>
            )}

            {tempCode && (
                <div className="p-6 bg-green-50 border-2 border-green-500 rounded-lg text-center space-y-4">
                    <p className="font-semibold text-lg text-green-700">{successMessage}</p>
                    <p className="text-sm text-gray-600">고객에게 이 코드로 로그인하도록 안내해주세요.</p>
                    <div className="text-5xl font-extrabold tracking-widest text-blue-700 bg-white p-3 rounded-md border border-dashed border-blue-300">
                        {tempCode}
                    </div>
                    <button 
                        onClick={() => { setTempCode(null); setPhone(''); setName(''); }}
                        className="mt-2 text-blue-600 text-sm hover:underline"
                    >
                        새로운 고객 처리 시작
                    </button>
                </div>
            )}
        </div>
    );
}