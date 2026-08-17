import datetime
from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Habit, HabitLog

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'last_login']

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=4)

    class Meta:
        model = User
        fields = ['username', 'email', 'password']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )
        return user

class HabitLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = HabitLog
        fields = ['id', 'habit_fk', 'date', 'is_done']

class HabitSerializer(serializers.ModelSerializer):
    logs = serializers.SerializerMethodField()
    streak = serializers.SerializerMethodField()
    owner_username = serializers.ReadOnlyField(source='owner.username')

    class Meta:
        model = Habit
        fields = ['id', 'name', 'owner', 'owner_username', 'created_at', 'logs', 'streak']
        read_only_fields = ['id', 'owner', 'owner_username', 'created_at', 'logs', 'streak']

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
