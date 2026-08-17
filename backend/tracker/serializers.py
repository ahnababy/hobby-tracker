import datetime
from rest_framework import serializers
from .models import Habit, HabitLog

class HabitLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = HabitLog
        fields = ['id', 'habit_fk', 'date', 'is_done']

class HabitSerializer(serializers.ModelSerializer):
    logs = serializers.SerializerMethodField()
    streak = serializers.SerializerMethodField()

    class Meta:
        model = Habit
        fields = ['id', 'name', 'owner', 'created_at', 'logs', 'streak']
        read_only_fields = ['id', 'created_at', 'logs', 'streak']

    def get_logs(self, obj):
        request = self.context.get('request')
        logs_qs = obj.logs.all()
        if request:
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            if start_date and end_date:
                logs_qs = logs_qs.filter(date__range=[start_date, end_date])
        return HabitLogSerializer(logs_qs, many=True).data

    def get_streak(self, obj):
        today = datetime.date.today()
        completed_dates = set(obj.logs.filter(is_done=True).values_list('date', flat=True))
        
        streak = 0
        curr = today
        if curr not in completed_dates:
            curr = today - datetime.timedelta(days=1)
        
        while curr in completed_dates:
            streak += 1
            curr -= datetime.timedelta(days=1)
            
        return streak
